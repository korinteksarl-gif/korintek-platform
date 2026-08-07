const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

// Génère une référence séquentielle par année, ex: EC-2026-000001
async function generateReference(date) {
  const year = new Date(date).getFullYear();
  const prefix = `EC-${year}-`;
  const count = await prisma.journalEntry.count({ where: { reference: { startsWith: prefix } } });
  const next = String(count + 1).padStart(6, '0');
  return `${prefix}${next}`;
}

// Vérifie qu'une écriture est valide : au moins 2 lignes, chaque ligne a soit
// un débit soit un crédit (jamais les deux, jamais aucun), et le total des
// débits égale exactement le total des crédits — la règle d'or de la partie double.
function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length < 2) {
    return "Une écriture doit comporter au moins 2 lignes.";
  }
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    if (debit < 0 || credit < 0) return 'Les montants ne peuvent pas être négatifs.';
    if (debit > 0 && credit > 0) return 'Une ligne ne peut pas avoir à la fois un débit et un crédit.';
    if (debit === 0 && credit === 0) return 'Chaque ligne doit avoir un débit ou un crédit non nul.';
    if (!line.accountId) return 'Chaque ligne doit référencer un compte.';
    totalDebit += debit;
    totalCredit += credit;
  }
  if (totalDebit !== totalCredit) {
    return `Écriture déséquilibrée : total débit ${totalDebit} ≠ total crédit ${totalCredit}.`;
  }
  return null;
}

// GET /api/v1/journal — liste des écritures, avec filtres optionnels
async function list(req, res, next) {
  try {
    const { dateFrom, dateTo, accountId } = req.query;
    const where = {};
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }
    if (accountId) {
      where.lines = { some: { accountId } };
    }
    const entries = await prisma.journalEntry.findMany({
      where,
      include: {
        lines: { include: { account: true } },
        createdBy: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ entries });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/journal/:id
async function getOne(req, res, next) {
  try {
    const { id } = req.params;
    const entry = await prisma.journalEntry.findUnique({
      where: { id },
      include: { lines: { include: { account: true } }, createdBy: { select: { id: true, nom: true, prenom: true } } },
    });
    if (!entry) return res.status(404).json({ error: 'Écriture introuvable.' });
    res.json({ entry });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/journal — créer une écriture équilibrée
async function create(req, res, next) {
  try {
    const { date, description, lines } = req.body;
    if (!date || !description) {
      return res.status(400).json({ error: 'La date et la description sont requises.' });
    }

    const validationError = validateLines(lines);
    if (validationError) return res.status(400).json({ error: validationError });

    const reference = await generateReference(date);

    const entry = await prisma.journalEntry.create({
      data: {
        reference,
        date: new Date(date),
        description,
        createdById: req.user?.id || null,
        lines: {
          create: lines.map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            label: l.label || null,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });

    await logAction(req.user?.id, 'JOURNAL_ENTRY_CREATED', { entryId: entry.id, reference });
    res.status(201).json({ entry });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/journal/:id — SUPER_ADMIN uniquement (une vraie compta ne
// supprime jamais d'écriture passée ; en V1 on l'autorise pour corriger des
// erreurs de saisie récentes, à remplacer par des écritures de contre-passation
// une fois le module utilisé en production sur plusieurs mois).
async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.journalEntry.delete({ where: { id } });
    await logAction(req.user?.id, 'JOURNAL_ENTRY_DELETED', { entryId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, remove };

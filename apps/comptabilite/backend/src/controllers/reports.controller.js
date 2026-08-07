const prisma = require('../config/db');

// Comptes à solde normalement débiteur (le débit les augmente) vs créditeur
// (le crédit les augmente) — base de tout calcul de solde en partie double.
const DEBIT_NORMAL = ['ACTIF', 'CHARGE'];

function computeBalance(type, totalDebit, totalCredit) {
  return DEBIT_NORMAL.includes(type) ? totalDebit - totalCredit : totalCredit - totalDebit;
}

// GET /api/v1/reports/grand-livre/:accountId — mouvements d'un compte avec solde progressif
async function grandLivre(req, res, next) {
  try {
    const { accountId } = req.params;
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return res.status(404).json({ error: 'Compte introuvable.' });

    const lines = await prisma.journalLine.findMany({
      where: { accountId },
      include: { journalEntry: true },
      orderBy: [{ journalEntry: { date: 'asc' } }, { journalEntry: { createdAt: 'asc' } }],
    });

    let running = 0;
    const movements = lines.map((l) => {
      const delta = DEBIT_NORMAL.includes(account.type) ? l.debit - l.credit : l.credit - l.debit;
      running += delta;
      return {
        date: l.journalEntry.date,
        reference: l.journalEntry.reference,
        description: l.journalEntry.description,
        label: l.label,
        debit: l.debit,
        credit: l.credit,
        soldeProgressif: running,
      };
    });

    res.json({ account, movements, soldeFinal: running });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/reports/balance — balance générale : total débit/crédit/solde par compte
async function balance(req, res, next) {
  try {
    const accounts = await prisma.account.findMany({
      include: { lines: true },
      orderBy: { code: 'asc' },
    });

    const rows = accounts.map((acc) => {
      const totalDebit = acc.lines.reduce((sum, l) => sum + l.debit, 0);
      const totalCredit = acc.lines.reduce((sum, l) => sum + l.credit, 0);
      const solde = computeBalance(acc.type, totalDebit, totalCredit);
      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        totalDebit,
        totalCredit,
        solde,
      };
    }).filter((r) => r.totalDebit > 0 || r.totalCredit > 0 || req.query.includeEmpty === 'true');

    const totalDebitGeneral = rows.reduce((s, r) => s + r.totalDebit, 0);
    const totalCreditGeneral = rows.reduce((s, r) => s + r.totalCredit, 0);

    res.json({ rows, totalDebitGeneral, totalCreditGeneral, equilibree: totalDebitGeneral === totalCreditGeneral });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/reports/bilan — bilan simplifié (Actif / Passif + Capitaux propres + Résultat)
async function bilan(req, res, next) {
  try {
    const accounts = await prisma.account.findMany({ include: { lines: true } });

    function totalsByType(type) {
      return accounts
        .filter((a) => a.type === type)
        .map((a) => {
          const totalDebit = a.lines.reduce((s, l) => s + l.debit, 0);
          const totalCredit = a.lines.reduce((s, l) => s + l.credit, 0);
          return { code: a.code, name: a.name, solde: computeBalance(a.type, totalDebit, totalCredit) };
        })
        .filter((a) => a.solde !== 0);
    }

    const actifLines = totalsByType('ACTIF');
    const passifLines = totalsByType('PASSIF');
    const capitauxLines = totalsByType('CAPITAUX_PROPRES');
    const produitLines = totalsByType('PRODUIT');
    const chargeLines = totalsByType('CHARGE');

    const totalActif = actifLines.reduce((s, a) => s + a.solde, 0);
    const totalPassif = passifLines.reduce((s, a) => s + a.solde, 0);
    const totalCapitaux = capitauxLines.reduce((s, a) => s + a.solde, 0);
    const totalProduits = produitLines.reduce((s, a) => s + a.solde, 0);
    const totalCharges = chargeLines.reduce((s, a) => s + a.solde, 0);
    const resultatNet = totalProduits - totalCharges;

    res.json({
      actif: { lines: actifLines, total: totalActif },
      passif: { lines: passifLines, total: totalPassif },
      capitauxPropres: { lines: capitauxLines, total: totalCapitaux },
      resultatNet,
      totalPassifEtCapitaux: totalPassif + totalCapitaux + resultatNet,
      equilibre: totalActif === totalPassif + totalCapitaux + resultatNet,
      compteResultat: {
        produits: { lines: produitLines, total: totalProduits },
        charges: { lines: chargeLines, total: totalCharges },
        resultatNet,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { grandLivre, balance, bilan };

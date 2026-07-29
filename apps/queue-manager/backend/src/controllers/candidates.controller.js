const prisma = require('../config/db');
const { generateCandidateNumber } = require('../utils/candidateNumber');
const { logAction } = require('../utils/audit');
const { promoteDueForAdmission, annotateWithDelays } = require('../utils/timing');

function dayRange(dateStr) {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// GET /api/v1/candidates?date=2026-07-28
async function list(req, res, next) {
  try {
    const { date, statut, search } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);

    // Déclenche le passage automatique WAITING -> ADMISSION pour les candidats
    // du jour concerné, avant de renvoyer la liste (pas de cron nécessaire).
    await promoteDueForAdmission(targetDate);

    const where = {};
    if (date) {
      const { start, end } = dayRange(date);
      where.datePassage = { gte: start, lt: end };
    }
    if (statut) {
      where.statut = statut;
    }
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { numero: { contains: search, mode: 'insensitive' } },
      ];
    }

    const candidates = await prisma.candidate.findMany({
      where,
      orderBy: { numero: 'asc' },
    });

    res.json({ candidates: annotateWithDelays(candidates) });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/candidates/stats?date=2026-07-28
async function stats(req, res, next) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    await promoteDueForAdmission(date);
    const { start, end } = dayRange(date);

    const candidates = await prisma.candidate.findMany({
      where: { datePassage: { gte: start, lt: end } },
      select: { statut: true },
    });

    const counts = {
      total: candidates.length,
      WAITING: 0,
      ADMISSION: 0,
      CALLED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      ABSENT: 0,
    };
    candidates.forEach((c) => { counts[c.statut] = (counts[c.statut] || 0) + 1; });

    res.json({ date, stats: counts });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/candidates
async function create(req, res, next) {
  try {
    const { nom, prenom, email, telephone, examen, datePassage, heureConvocation, poste, dureeMinutes } = req.body;

    if (!nom || !prenom || !examen || !datePassage || !heureConvocation) {
      return res.status(400).json({ error: 'Champs obligatoires manquants (nom, prénom, examen, date, heure).' });
    }

    const numero = await generateCandidateNumber(datePassage);

    const candidate = await prisma.candidate.create({
      data: {
        numero,
        nom,
        prenom,
        email: email || null,
        telephone: telephone || null,
        examen,
        poste: poste || null,
        dureeMinutes: dureeMinutes ? Number(dureeMinutes) : 120,
        datePassage: new Date(datePassage),
        heureConvocation,
      },
    });

    await logAction(req.user?.id, 'CREATE_CANDIDATE', { candidateId: candidate.id, numero });

    res.status(201).json({ candidate });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/candidates/:id
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { nom, prenom, email, telephone, examen, datePassage, heureConvocation, statut, poste, dureeMinutes } = req.body;

    const data = {
      ...(nom && { nom }),
      ...(prenom && { prenom }),
      ...(email !== undefined && { email }),
      ...(telephone !== undefined && { telephone }),
      ...(examen && { examen }),
      ...(datePassage && { datePassage: new Date(datePassage) }),
      ...(heureConvocation && { heureConvocation }),
      ...(poste !== undefined && { poste }),
      ...(dureeMinutes !== undefined && { dureeMinutes: Number(dureeMinutes) }),
      ...(statut && { statut }),
    };

    if (statut === 'CALLED') data.startedAt = new Date();
    if (statut === 'COMPLETED') data.completedAt = new Date();

    const candidate = await prisma.candidate.update({ where: { id }, data });

    await logAction(req.user?.id, 'UPDATE_CANDIDATE', { candidateId: id });

    res.json({ candidate });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/candidates/:id
async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.candidate.delete({ where: { id } });
    await logAction(req.user?.id, 'DELETE_CANDIDATE', { candidateId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, stats, create, update, remove };

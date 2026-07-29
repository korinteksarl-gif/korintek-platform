const prisma = require('../config/db');
const { logAction } = require('../utils/audit');
const { promoteDueForAdmission } = require('../utils/timing');

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/v1/queue/current
// Renvoie le dernier candidat appelé en salle d'examen (affiché sur l'écran
// salle d'attente et la tablette agent). Déclenche aussi le passage en
// ADMISSION des candidats arrivant à J-15min (pas de cron nécessaire).
async function current(req, res, next) {
  try {
    await promoteDueForAdmission(todayStr());
    const { start, end } = todayRange();
    const candidate = await prisma.candidate.findFirst({
      where: {
        datePassage: { gte: start, lt: end },
        statut: { in: ['CALLED', 'IN_PROGRESS'] },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ candidate: candidate || null });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/queue/admission-current
// PUBLIC — renvoie le dernier candidat passé en statut ADMISSION (rappel T-15min),
// consommé par l'écran salle d'attente pour l'annonce "montez pour les formalités".
async function admissionCurrent(req, res, next) {
  try {
    await promoteDueForAdmission(todayStr());
    const { start, end } = todayRange();
    const candidate = await prisma.candidate.findFirst({
      where: { datePassage: { gte: start, lt: end }, statut: 'ADMISSION' },
      orderBy: { admissionNotifiedAt: 'desc' },
    });
    res.json({ candidate: candidate || null });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/queue/admission-list
// Réservé staff — liste complète des candidats actuellement en formalités
// d'admission, pour le panneau "À préparer maintenant" côté agent d'accueil.
async function admissionList(req, res, next) {
  try {
    await promoteDueForAdmission(todayStr());
    const { start, end } = todayRange();
    const candidates = await prisma.candidate.findMany({
      where: { datePassage: { gte: start, lt: end }, statut: 'ADMISSION' },
      orderBy: { heureConvocation: 'asc' },
    });
    res.json({ candidates });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/queue/next
// Appelle le prochain candidat (priorité aux candidats déjà en ADMISSION,
// c'est-à-dire déjà préparés ; à défaut, un candidat encore WAITING).
async function callNext(req, res, next) {
  try {
    const { start, end } = todayRange();

    const next_ = await prisma.candidate.findFirst({
      where: { datePassage: { gte: start, lt: end }, statut: { in: ['ADMISSION', 'WAITING'] } },
      orderBy: [{ statut: 'asc' }, { numero: 'asc' }], // ADMISSION avant WAITING (ordre alpha du enum)
    });

    if (!next_) {
      return res.status(404).json({ error: "Aucun candidat en attente aujourd'hui." });
    }

    const candidate = await prisma.candidate.update({
      where: { id: next_.id },
      data: { statut: 'CALLED', startedAt: new Date() },
    });

    await logAction(req.user?.id, 'CALL_NEXT_CANDIDATE', { candidateId: candidate.id, numero: candidate.numero });

    res.json({ candidate });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/queue/:id/complete
async function complete(req, res, next) {
  try {
    const { id } = req.params;
    const candidate = await prisma.candidate.update({
      where: { id },
      data: { statut: 'COMPLETED', completedAt: new Date() },
    });
    await logAction(req.user?.id, 'COMPLETE_CANDIDATE', { candidateId: id });
    res.json({ candidate });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/queue/:id/absent
async function markAbsent(req, res, next) {
  try {
    const { id } = req.params;
    const candidate = await prisma.candidate.update({
      where: { id },
      data: { statut: 'ABSENT' },
    });
    await logAction(req.user?.id, 'MARK_ABSENT', { candidateId: id });
    res.json({ candidate });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/queue/public-stats
// PUBLIC — statistiques agrégées du jour, sans aucune donnée personnelle, destinées
// au bandeau d'information de l'écran salle d'attente.
async function publicStats(req, res, next) {
  try {
    await promoteDueForAdmission(todayStr());
    const { start, end } = todayRange();
    const candidates = await prisma.candidate.findMany({
      where: { datePassage: { gte: start, lt: end } },
      select: { statut: true },
    });
    const counts = { total: candidates.length, waiting: 0, admission: 0, called: 0, completed: 0 };
    candidates.forEach((c) => {
      if (c.statut === 'WAITING') counts.waiting++;
      if (c.statut === 'ADMISSION') counts.admission++;
      if (c.statut === 'CALLED' || c.statut === 'IN_PROGRESS') counts.called++;
      if (c.statut === 'COMPLETED') counts.completed++;
    });
    res.json(counts);
  } catch (err) {
    next(err);
  }
}

module.exports = { current, admissionCurrent, admissionList, publicStats, callNext, complete, markAbsent };

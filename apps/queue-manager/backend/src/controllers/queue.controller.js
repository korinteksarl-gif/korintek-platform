const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// GET /api/v1/queue/current
// Renvoie le dernier candidat appelé (affiché sur l'écran salle d'attente et la tablette agent)
async function current(req, res, next) {
  try {
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

// POST /api/v1/queue/next
// Appelle le prochain candidat WAITING (par ordre de numéro) et le passe à CALLED
async function callNext(req, res, next) {
  try {
    const { start, end } = todayRange();

    const next_ = await prisma.candidate.findFirst({
      where: { datePassage: { gte: start, lt: end }, statut: 'WAITING' },
      orderBy: { numero: 'asc' },
    });

    if (!next_) {
      return res.status(404).json({ error: "Aucun candidat en attente aujourd'hui." });
    }

    const candidate = await prisma.candidate.update({
      where: { id: next_.id },
      data: { statut: 'CALLED' },
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
      data: { statut: 'COMPLETED' },
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

module.exports = { current, callNext, complete, markAbsent };

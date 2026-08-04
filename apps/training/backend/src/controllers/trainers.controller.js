const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

// GET /api/v1/trainers — annuaire complet des formateurs
async function list(req, res, next) {
  try {
    const trainers = await prisma.trainer.findMany({
      include: { sessions: { include: { course: true }, orderBy: { startDate: 'desc' } } },
      orderBy: { nom: 'asc' },
    });
    res.json({ trainers });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/trainers — créer une fiche formateur
async function create(req, res, next) {
  try {
    const { nom, prenom, email, telephone, defaultPaymentMode, defaultRate } = req.body;
    if (!nom || !prenom) return res.status(400).json({ error: 'Nom et prénom sont requis.' });
    const trainer = await prisma.trainer.create({
      data: {
        nom, prenom,
        email: email || null,
        telephone: telephone || null,
        defaultPaymentMode: defaultPaymentMode || 'FLAT_PER_SESSION',
        defaultRate: Number(defaultRate) || 0,
      },
    });
    await logAction(req.user?.id, 'TRAINER_CREATED', { trainerId: trainer.id, nom, prenom });
    res.status(201).json({ trainer });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/trainers/:id — modifier une fiche formateur
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { nom, prenom, email, telephone, defaultPaymentMode, defaultRate, active } = req.body;
    const trainer = await prisma.trainer.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(prenom !== undefined && { prenom }),
        ...(email !== undefined && { email }),
        ...(telephone !== undefined && { telephone }),
        ...(defaultPaymentMode !== undefined && { defaultPaymentMode }),
        ...(defaultRate !== undefined && { defaultRate: Number(defaultRate) }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    });
    await logAction(req.user?.id, 'TRAINER_UPDATED', { trainerId: id });
    res.json({ trainer });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/trainers/sessions/:sessionId/payment — mettre à jour le paiement d'une session
async function updateSessionPayment(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { paymentMode, paymentAmount, paymentStatus, paymentNotes } = req.body;
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: {
        ...(paymentMode !== undefined && { paymentMode }),
        ...(paymentAmount !== undefined && { paymentAmount: Number(paymentAmount) }),
        ...(paymentStatus !== undefined && { paymentStatus }),
        ...(paymentNotes !== undefined && { paymentNotes }),
      },
      include: { trainer: true, course: true },
    });
    await logAction(req.user?.id, 'SESSION_PAYMENT_UPDATED', { sessionId, paymentStatus });
    res.json({ session });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, updateSessionPayment };

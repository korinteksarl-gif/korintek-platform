const prisma = require('../config/db');

async function findOrCreateStudent({ nom, prenom, email, telephone }) {
  // Correspondance simple par email si fourni, sinon création systématique
  if (email) {
    const existing = await prisma.student.findFirst({ where: { email } });
    if (existing) return existing;
  }
  return prisma.student.create({ data: { nom, prenom, email: email || null, telephone: telephone || null } });
}

// POST /api/v1/enrollments/public — inscription en ligne par l'étudiant lui-même
async function createPublic(req, res, next) {
  try {
    const { nom, prenom, email, telephone, courseId, sessionId } = req.body;
    if (!nom || !prenom || !courseId) {
      return res.status(400).json({ error: 'Nom, prénom et formation sont requis.' });
    }
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || !course.active) {
      return res.status(404).json({ error: 'Formation introuvable ou indisponible.' });
    }

    const student = await findOrCreateStudent({ nom, prenom, email, telephone });
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId,
        sessionId: sessionId || null,
        enrolledVia: 'SELF',
        amountDue: course.price,
      },
    });
    res.status(201).json({ enrollment });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/enrollments — inscription saisie par l'équipe (accueil/agent)
async function createStaff(req, res, next) {
  try {
    const { nom, prenom, email, telephone, courseId, sessionId, paymentMethod, amountPaid, notes } = req.body;
    if (!nom || !prenom || !courseId) {
      return res.status(400).json({ error: 'Nom, prénom et formation sont requis.' });
    }
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return res.status(404).json({ error: 'Formation introuvable.' });

    const student = await findOrCreateStudent({ nom, prenom, email, telephone });
    const paid = Number(amountPaid) || 0;
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId,
        sessionId: sessionId || null,
        enrolledVia: 'STAFF',
        amountDue: course.price,
        amountPaid: paid,
        paymentMethod: paymentMethod || null,
        statut: paid >= course.price && course.price > 0 ? 'PAID' : paid > 0 ? 'PAYMENT_PARTIAL' : 'PENDING',
        notes: notes || null,
      },
    });
    res.status(201).json({ enrollment });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/enrollments — liste staff, avec filtres optionnels
async function list(req, res, next) {
  try {
    const { statut, courseId } = req.query;
    const where = {};
    if (statut) where.statut = statut;
    if (courseId) where.courseId = courseId;

    const enrollments = await prisma.enrollment.findMany({
      where,
      include: { student: true, course: true, session: true, certificate: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ enrollments });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/enrollments/:id — mise à jour statut / paiement / session
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { statut, paymentMethod, amountPaid, sessionId, notes } = req.body;
    const enrollment = await prisma.enrollment.update({
      where: { id },
      data: {
        ...(statut !== undefined && { statut }),
        ...(paymentMethod !== undefined && { paymentMethod }),
        ...(amountPaid !== undefined && { amountPaid: Number(amountPaid) }),
        ...(sessionId !== undefined && { sessionId: sessionId || null }),
        ...(notes !== undefined && { notes }),
      },
      include: { student: true, course: true, session: true, certificate: true },
    });
    res.json({ enrollment });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.enrollment.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { createPublic, createStaff, list, update, remove };

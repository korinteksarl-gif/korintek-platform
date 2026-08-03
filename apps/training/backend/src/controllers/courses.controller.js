const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

// GET /api/v1/courses — public (catalogue) : ne renvoie que les formations actives
async function listPublic(req, res, next) {
  try {
    const courses = await prisma.course.findMany({
      where: { active: true },
      include: { sessions: { where: { active: true }, orderBy: { startDate: 'asc' } } },
      orderBy: { title: 'asc' },
    });
    res.json({ courses });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/courses/admin — staff : toutes les formations, actives ou non
async function listAll(req, res, next) {
  try {
    const courses = await prisma.course.findMany({
      include: { sessions: true, _count: { select: { enrollments: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ courses });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { title, description, durationHours, price } = req.body;
    if (!title) return res.status(400).json({ error: 'Le titre est requis.' });
    const course = await prisma.course.create({
      data: { title, description: description || null, durationHours: Number(durationHours) || 0, price: Number(price) || 0 },
    });
    await logAction(req.user?.id, 'COURSE_CREATED', { courseId: course.id, title });
    res.status(201).json({ course });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, durationHours, price, active } = req.body;
    const course = await prisma.course.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(durationHours !== undefined && { durationHours: Number(durationHours) }),
        ...(price !== undefined && { price: Number(price) }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    });
    await logAction(req.user?.id, 'COURSE_UPDATED', { courseId: id });
    res.json({ course });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.course.delete({ where: { id } });
    await logAction(req.user?.id, 'COURSE_DELETED', { courseId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// --- Sessions (cohortes) ---
async function createSession(req, res, next) {
  try {
    const { courseId } = req.params;
    const { startDate, endDate, formateur, capacity } = req.body;
    if (!startDate) return res.status(400).json({ error: 'La date de début est requise.' });
    const session = await prisma.session.create({
      data: {
        courseId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        formateur: formateur || null,
        capacity: capacity ? Number(capacity) : null,
      },
    });
    await logAction(req.user?.id, 'SESSION_CREATED', { sessionId: session.id, courseId });
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
}

async function updateSession(req, res, next) {
  try {
    const { id } = req.params;
    const { startDate, endDate, formateur, capacity, active } = req.body;
    const session = await prisma.session.update({
      where: { id },
      data: {
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(formateur !== undefined && { formateur }),
        ...(capacity !== undefined && { capacity: capacity ? Number(capacity) : null }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    });
    await logAction(req.user?.id, 'SESSION_UPDATED', { sessionId: id });
    res.json({ session });
  } catch (err) {
    next(err);
  }
}

module.exports = { listPublic, listAll, create, update, remove, createSession, updateSession };

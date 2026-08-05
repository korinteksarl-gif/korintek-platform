const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

// GET /api/v1/contacts — liste avec filtres optionnels (stage, type, recherche texte)
async function list(req, res, next) {
  try {
    const { stage, type, search, assignedToId } = req.query;
    const where = {};
    if (stage) where.stage = stage;
    if (type) where.type = type;
    if (assignedToId) where.assignedToId = assignedToId;
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { prenom: { contains: search, mode: 'insensitive' } },
        { entreprise: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    const contacts = await prisma.contact.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, nom: true, prenom: true } },
        interactions: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ contacts });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/contacts/:id — détail d'un contact
async function getOne(req, res, next) {
  try {
    const { id } = req.params;
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, nom: true, prenom: true } },
        interactions: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!contact) return res.status(404).json({ error: 'Contact introuvable.' });
    res.json({ contact });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/contacts — créer un contact
async function create(req, res, next) {
  try {
    const { nom, prenom, entreprise, email, telephone, type, source, notes, assignedToId } = req.body;
    if (!nom) return res.status(400).json({ error: 'Le nom est requis.' });

    const contact = await prisma.contact.create({
      data: {
        nom,
        prenom: prenom || null,
        entreprise: entreprise || null,
        email: email || null,
        telephone: telephone || null,
        type: type || 'PROSPECT_FORMATION',
        source: source || null,
        notes: notes || null,
        assignedToId: assignedToId || null,
      },
    });
    await logAction(req.user?.id, 'CONTACT_CREATED', { contactId: contact.id, nom });
    res.status(201).json({ contact });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/contacts/:id — modifier un contact (y compris changement d'étape pipeline)
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const {
      nom, prenom, entreprise, email, telephone,
      type, stage, source, notes, assignedToId, trainingEnrollmentId,
    } = req.body;

    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(prenom !== undefined && { prenom }),
        ...(entreprise !== undefined && { entreprise }),
        ...(email !== undefined && { email }),
        ...(telephone !== undefined && { telephone }),
        ...(type !== undefined && { type }),
        ...(stage !== undefined && { stage }),
        ...(source !== undefined && { source }),
        ...(notes !== undefined && { notes }),
        ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
        ...(trainingEnrollmentId !== undefined && { trainingEnrollmentId: trainingEnrollmentId || null }),
      },
      include: {
        assignedTo: { select: { id: true, nom: true, prenom: true } },
        interactions: { orderBy: { createdAt: 'desc' } },
      },
    });
    await logAction(req.user?.id, 'CONTACT_UPDATED', { contactId: id, stage });
    res.json({ contact });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/contacts/:id
async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.contact.delete({ where: { id } });
    await logAction(req.user?.id, 'CONTACT_DELETED', { contactId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/contacts/:contactId/interactions — ajouter une interaction (appel, email, réunion, note)
async function addInteraction(req, res, next) {
  try {
    const { contactId } = req.params;
    const { type, notes } = req.body;
    if (!notes) return res.status(400).json({ error: 'Le contenu de l\'interaction est requis.' });

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) return res.status(404).json({ error: 'Contact introuvable.' });

    const interaction = await prisma.interaction.create({
      data: {
        contactId,
        type: type || 'NOTE',
        notes,
        createdById: req.user?.id || null,
      },
    });

    // Toucher updatedAt du contact pour qu'il remonte dans les listes triées par activité récente
    await prisma.contact.update({ where: { id: contactId }, data: { updatedAt: new Date() } });

    await logAction(req.user?.id, 'INTERACTION_ADDED', { contactId, type: interaction.type });
    res.status(201).json({ interaction });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/contacts/stats — compteurs par étape, pour le tableau de bord
async function stats(req, res, next) {
  try {
    const counts = await prisma.contact.groupBy({
      by: ['stage'],
      _count: { _all: true },
    });
    const byStage = counts.reduce((acc, row) => {
      acc[row.stage] = row._count._all;
      return acc;
    }, {});
    res.json({ byStage });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, addInteraction, stats };

const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

// GET /api/v1/ads — PUBLIC, consommé par l'écran salle d'attente /display
async function listActive(req, res, next) {
  try {
    const ads = await prisma.advertisement.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
      select: { id: true, title: true, imageData: true, linkUrl: true, order: true },
    });
    res.json({ ads });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/ads/admin — liste complète (actives + inactives) pour l'écran de gestion
async function listAll(req, res, next) {
  try {
    const ads = await prisma.advertisement.findMany({ orderBy: { order: 'asc' } });
    res.json({ ads });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/ads — multipart/form-data { file, title?, linkUrl? }
async function create(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image reçue (champ "file").' });
    }
    const { title, linkUrl } = req.body;
    const mimeType = req.file.mimetype;
    const base64 = req.file.buffer.toString('base64');
    const imageData = `data:${mimeType};base64,${base64}`;

    const maxOrder = await prisma.advertisement.aggregate({ _max: { order: true } });
    const order = (maxOrder._max.order ?? -1) + 1;

    const ad = await prisma.advertisement.create({
      data: { title: title || null, linkUrl: linkUrl || null, imageData, order, active: true },
    });

    await logAction(req.user?.id, 'CREATE_ADVERTISEMENT', { adId: ad.id, title });
    res.status(201).json({ ad: { ...ad, imageData: undefined } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/ads/:id — { title?, linkUrl?, active?, order? }
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { title, linkUrl, active, order } = req.body;

    const ad = await prisma.advertisement.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(linkUrl !== undefined && { linkUrl }),
        ...(active !== undefined && { active: Boolean(active) }),
        ...(order !== undefined && { order: Number(order) }),
      },
    });

    await logAction(req.user?.id, 'UPDATE_ADVERTISEMENT', { adId: id });
    res.json({ ad: { ...ad, imageData: undefined } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/ads/:id
async function remove(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.advertisement.delete({ where: { id } });
    await logAction(req.user?.id, 'DELETE_ADVERTISEMENT', { adId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listActive, listAll, create, update, remove };

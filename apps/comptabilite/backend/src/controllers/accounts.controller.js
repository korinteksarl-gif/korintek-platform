const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

// GET /api/v1/accounts — liste du plan comptable
async function list(req, res, next) {
  try {
    const { type, active } = req.query;
    const where = {};
    if (type) where.type = type;
    if (active !== undefined) where.active = active === 'true';
    const accounts = await prisma.account.findMany({ where, orderBy: { code: 'asc' } });
    res.json({ accounts });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/accounts — créer un compte
async function create(req, res, next) {
  try {
    const { code, name, type, description } = req.body;
    if (!code || !name || !type) {
      return res.status(400).json({ error: 'Code, nom et type sont requis.' });
    }
    const existing = await prisma.account.findUnique({ where: { code } });
    if (existing) return res.status(409).json({ error: 'Ce code de compte existe déjà.' });

    const account = await prisma.account.create({
      data: { code, name, type, description: description || null },
    });
    await logAction(req.user?.id, 'ACCOUNT_CREATED', { accountId: account.id, code });
    res.status(201).json({ account });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/accounts/:id — modifier un compte (nom, description, actif)
async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, active } = req.body;
    const account = await prisma.account.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    });
    await logAction(req.user?.id, 'ACCOUNT_UPDATED', { accountId: id });
    res.json({ account });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update };

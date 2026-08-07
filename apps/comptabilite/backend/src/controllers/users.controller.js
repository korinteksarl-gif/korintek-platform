const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

async function list(req, res, next) {
  try {
    const users = await prisma.staffUser.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { role, active } = req.body;

    if (id === req.user.id && role !== undefined && role !== 'SUPER_ADMIN') {
      return res.status(400).json({ error: 'Vous ne pouvez pas retirer votre propre rôle SUPER_ADMIN.' });
    }

    const user = await prisma.staffUser.update({
      where: { id },
      data: {
        ...(role !== undefined && { role }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    });
    await logAction(req.user?.id, 'USER_ROLE_UPDATED', { targetUserId: id, role, active });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, update };

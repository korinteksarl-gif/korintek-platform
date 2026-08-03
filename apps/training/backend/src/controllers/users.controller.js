const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

const VALID_ROLES = ['PENDING', 'SUPER_ADMIN', 'ADMIN', 'TRAINER', 'FINANCE'];

// GET /api/v1/users
async function list(req, res, next) {
  try {
    const users = await prisma.staffUser.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, nom: true, prenom: true, email: true, role: true, active: true, createdAt: true },
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/users/:id/role
async function updateRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Rôle invalide.' });
    }
    const user = await prisma.staffUser.update({ where: { id }, data: { role } });
    await logAction(req.user?.id, 'USER_ROLE_UPDATED', { targetUserId: id, newRole: role });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/users/:id/active
async function toggleActive(req, res, next) {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const user = await prisma.staffUser.update({ where: { id }, data: { active: Boolean(active) } });
    await logAction(req.user?.id, active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED', { targetUserId: id });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/users/:id
async function remove(req, res, next) {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
    }
    await prisma.staffUser.delete({ where: { id } });
    await logAction(req.user?.id, 'USER_DELETED', { targetUserId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, updateRole, toggleActive, remove };

const prisma = require('../config/db');

// Journalise une action pour traçabilité (audit). Ne doit jamais faire planter
// l'action principale si l'écriture du log échoue — on log l'erreur et on continue.
async function logAction(userId, action, details) {
  try {
    await prisma.auditLog.create({
      data: { userId: userId || null, action, details: details || {} },
    });
  } catch (err) {
    console.error("Erreur lors de l'écriture du journal d'audit:", err.message);
  }
}

module.exports = { logAction };

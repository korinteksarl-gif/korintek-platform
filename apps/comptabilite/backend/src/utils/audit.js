const prisma = require('../config/db');

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

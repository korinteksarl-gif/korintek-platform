// Journalisation d'audit — utilisé par toutes les actions sensibles
const prisma = require('../config/db');

async function logAction(userId, action, details = null) {
  try {
    await prisma.auditLog.create({
      data: { userId: userId || null, action, details: details ? details : undefined },
    });
  } catch (err) {
    // L'audit ne doit jamais faire échouer l'action métier principale
    console.error('Erreur audit log:', err.message);
  }
}

module.exports = { logAction };

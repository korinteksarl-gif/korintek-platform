// Journalisation d'audit — trace toute action sensible (créations, modifications,
// suppressions, changements de statut/rôle) pour respecter les exigences de
// sécurité du projet (traçabilité complète des actions administratives).
const prisma = require('../config/db');

async function logAction(userId, action, details = null) {
  try {
    await prisma.auditLog.create({
      data: { userId: userId || null, action, details: details ? details : undefined },
    });
  } catch (err) {
    // L'audit ne doit jamais faire échouer l'action métier principale
    console.error('Erreur audit log (Training):', err.message);
  }
}

module.exports = { logAction };

// Utilitaire KORINTEK ID partagé — à importer par les futurs modules
// (Billing, CRM, Training) pour vérifier un JWT émis par Queue Manager
// sans dupliquer la logique d'authentification.
const jwt = require('jsonwebtoken');

function verifyKorintekToken(token, secret) {
  return jwt.verify(token, secret); // lève une exception si invalide/expiré
}

module.exports = { verifyKorintekToken };

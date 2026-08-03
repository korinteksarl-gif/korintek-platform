// Limitation de débit sur les endpoints publics — évite le spam d'inscriptions
// automatisées et le pillage systématique de la vérification d'attestations.
const rateLimit = require('express-rate-limit');

// Inscription publique : 10 tentatives par IP toutes les 15 minutes — largement
// suffisant pour un usage humain normal, bloque les scripts de spam.
const enrollmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives. Merci de réessayer dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Vérification d'attestation : 30 requêtes par IP par minute — permet une
// utilisation normale (un employeur qui vérifie plusieurs certificats) tout en
// empêchant un pillage systématique de la numérotation des attestations.
const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Trop de vérifications. Merci de réessayer dans une minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { enrollmentLimiter, verifyLimiter };

const rateLimit = require('express-rate-limit');

// Limite les tentatives de connexion locale pour freiner le bruteforce,
// sans bloquer le SSO Microsoft (qui a ses propres protections côté Azure).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessayez plus tard.' },
});

module.exports = { loginLimiter };

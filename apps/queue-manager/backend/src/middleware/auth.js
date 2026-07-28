// Middleware d'authentification KORINTEK ID (JWT)
// Réutilisable tel quel par les futurs modules (Billing, CRM, Training).
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  const token = header.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role, nom, prenom }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
}

// Utilisation: requireRole(['ADMIN', 'SUPER_ADMIN'])
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé pour votre rôle." });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };

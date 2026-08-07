const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentification requise.' });
    }
    const token = authHeader.slice('Bearer '.length);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.staffUser.findUnique({ where: { id: decoded.id } });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Compte introuvable ou désactivé.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Vous n'avez pas les droits nécessaires pour cette action." });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };

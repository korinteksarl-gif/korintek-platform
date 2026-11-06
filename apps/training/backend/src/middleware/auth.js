const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

// Vérifie le JWT puis recharge le compte en base à chaque requête : un compte
// désactivé ou un rôle modifié prend effet immédiatement, sans attendre l'expiration du jeton.
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  let payload;
  try {
    payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }
  try {
    const user = await prisma.staffUser.findUnique({ where: { id: payload.id } });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Compte introuvable ou désactivé.' });
    }
    req.user = { id: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom };
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentification requise.' });
    if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Accès refusé pour votre rôle.' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };

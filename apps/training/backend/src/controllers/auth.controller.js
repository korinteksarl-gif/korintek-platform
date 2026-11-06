const jwt = require('jsonwebtoken');
const { newState, consumeState, issueTicket, redeemTicket, safeEqual } = require('../utils/loginTicket');
const prisma = require('../config/db');
const { msalClient, SCOPES } = require('../config/msal');

async function microsoftLogin(req, res, next) {
  try {
    const authUrl = await msalClient.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: process.env.AZURE_REDIRECT_URI,
      state: newState(),
    });
    res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
}

async function microsoftCallback(req, res, next) {
  try {
    const { code, state } = req.query;
    if (!consumeState(state)) return res.redirect(`${process.env.FRONTEND_URL}/login?error=session_expiree`);
    if (!code) return res.status(400).send("Code d'autorisation manquant.");

    const tokenResponse = await msalClient.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri: process.env.AZURE_REDIRECT_URI,
    });

    const claims = tokenResponse.idTokenClaims || {};
    const email = (claims.preferred_username || claims.email || '').toLowerCase();
    const azureId = claims.oid;
    const fullName = claims.name || email;
    const [prenom, ...rest] = fullName.split(' ');
    const nom = rest.join(' ') || prenom;

    if (!email) return res.status(400).send("Impossible de récupérer l'email du compte Microsoft.");

    let user = await prisma.staffUser.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.staffUser.create({ data: { email, azureId, nom, prenom, role: 'PENDING', active: true } });
    } else if (!user.azureId) {
      user = await prisma.staffUser.update({ where: { id: user.id }, data: { azureId } });
    }

    if (!user.active) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=compte_desactive`);
    }

    const payload = { id: user.id, email: user.email, role: user.role, nom: user.nom, prenom: user.prenom };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?ticket=${issueTicket(token)}`);
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: req.user });
}

// POST /api/v1/auth/exchange — échange le ticket à usage unique contre le JWT
async function exchange(req, res) {
  const token = redeemTicket(req.body && req.body.ticket);
  if (!token) return res.status(401).json({ error: 'Lien de connexion expiré. Reconnectez-vous.' });
  res.json({ token });
}

module.exports = { microsoftLogin, microsoftCallback, me, exchange };

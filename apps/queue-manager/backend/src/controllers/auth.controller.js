const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { logAction } = require('../utils/audit');
const { msalClient, SCOPES } = require('../config/msal');

// POST /api/v1/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active || !user.passwordHash) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    await logAction(user.id, 'LOGIN', { email: user.email });

    res.json({ token, user: payload });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/auth/me
async function me(req, res) {
  res.json({ user: req.user });
}

// GET /api/v1/auth/microsoft/login
// Redirige l'utilisateur vers l'écran de connexion Microsoft 365
async function microsoftLogin(req, res, next) {
  try {
    const authUrl = await msalClient.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: process.env.AZURE_REDIRECT_URI,
    });
    res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/auth/microsoft/callback
// Microsoft redirige ici après connexion avec un "code" d'autorisation.
// On échange ce code contre les infos du compte, on crée/relie le compte
// KORINTEK ID correspondant, puis on redirige vers le frontend avec un JWT.
async function microsoftCallback(req, res, next) {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Code d\'autorisation manquant.');
    }

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

    if (!email) {
      return res.status(400).send('Impossible de récupérer l\'email du compte Microsoft.');
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: { email, azureId, nom, prenom, role: 'PENDING', active: true },
      });
      await logAction(user.id, 'CREATE_USER_VIA_SSO', { email });
    } else if (!user.azureId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { azureId } });
    }

    if (!user.active) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=compte_desactive`);
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      nom: user.nom,
      prenom: user.prenom,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    await logAction(user.id, 'LOGIN_SSO', { email: user.email });

    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err) {
    next(err);
  }
}

module.exports = { login, me, microsoftLogin, microsoftCallback };

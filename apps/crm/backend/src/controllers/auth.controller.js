const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET;
const REDIRECT_URI = process.env.AZURE_REDIRECT_URI;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

function issueToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function publicUser(user) {
  return {
    id: user.id,
    nom: user.nom,
    prenom: user.prenom,
    email: user.email,
    role: user.role,
  };
}

// GET /api/v1/auth/microsoft — redirige vers la page de connexion Microsoft Entra ID
function microsoftLogin(req, res) {
  const authorizeUrl = new URL(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`);
  authorizeUrl.searchParams.set('client_id', CLIENT_ID);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authorizeUrl.searchParams.set('response_mode', 'query');
  authorizeUrl.searchParams.set('scope', 'openid profile email User.Read');
  res.redirect(authorizeUrl.toString());
}

// GET /api/v1/auth/microsoft/callback — échange le code contre un profil,
// crée le compte KORINTEK ID (rôle PENDING) au premier login, puis émet un JWT.
async function microsoftCallback(req, res, next) {
  try {
    const { code, error: oauthError } = req.query;
    if (oauthError) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=microsoft_denied`);
    }
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=missing_code`);
    }

    // 1. Échange du code d'autorisation contre un jeton d'accès Microsoft
    const tokenResp = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        scope: 'openid profile email User.Read',
      }),
    });

    if (!tokenResp.ok) {
      const detail = await tokenResp.text();
      console.error('Échec échange token Microsoft:', detail);
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=token_exchange_failed`);
    }
    const tokenData = await tokenResp.json();

    // 2. Récupération du profil via Microsoft Graph
    const profileResp = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileResp.ok) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=profile_fetch_failed`);
    }
    const profile = await profileResp.json();

    const email = (profile.mail || profile.userPrincipalName || '').toLowerCase();
    if (!email) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`);
    }

    // 3. Recherche ou création du compte KORINTEK ID local (rôle PENDING par défaut)
    let user = await prisma.staffUser.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.staffUser.create({
        data: {
          email,
          nom: profile.surname || '',
          prenom: profile.givenName || '',
          azureId: profile.id || null,
        },
      });
      await logAction(null, 'SSO_ACCOUNT_CREATED', { email });
    } else if (!user.azureId && profile.id) {
      user = await prisma.staffUser.update({ where: { id: user.id }, data: { azureId: profile.id } });
    }

    if (!user.active) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=account_disabled`);
    }

    const jwtToken = issueToken(user);
    await logAction(user.id, 'SSO_LOGIN', { email });
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwtToken}`);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/login — compte de secours local, hors SSO.
// Comparaison directe aux identifiants seedés (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD),
// sans mot de passe stocké en base — cohérent avec le schéma StaffUser existant
// (aucun champ passwordHash), pour rester simple et éviter de dupliquer une logique
// de gestion de mots de passe qui n'existe nulle part ailleurs dans le portail.
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const expectedEmail = (process.env.SEED_ADMIN_EMAIL || '').toLowerCase();
    const expectedPassword = process.env.SEED_ADMIN_PASSWORD;

    if (email.toLowerCase() !== expectedEmail || password !== expectedPassword) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const user = await prisma.staffUser.findUnique({ where: { email: expectedEmail } });
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Compte de secours introuvable ou désactivé.' });
    }

    const token = issueToken(user);
    await logAction(user.id, 'LOCAL_LOGIN', { email: user.email });
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/auth/me — profil de l'utilisateur authentifié
async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

module.exports = { microsoftLogin, microsoftCallback, login, me };

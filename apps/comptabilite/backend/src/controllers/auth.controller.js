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
  return { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, role: user.role };
}

function microsoftLogin(req, res) {
  const authorizeUrl = new URL(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`);
  authorizeUrl.searchParams.set('client_id', CLIENT_ID);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authorizeUrl.searchParams.set('response_mode', 'query');
  authorizeUrl.searchParams.set('scope', 'openid profile email User.Read');
  res.redirect(authorizeUrl.toString());
}

async function microsoftCallback(req, res, next) {
  try {
    const { code, error: oauthError } = req.query;
    if (oauthError) return res.redirect(`${process.env.FRONTEND_URL}/login?error=microsoft_denied`);
    if (!code) return res.redirect(`${process.env.FRONTEND_URL}/login?error=missing_code`);

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
      console.error('Échec échange token Microsoft:', await tokenResp.text());
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=token_exchange_failed`);
    }
    const tokenData = await tokenResp.json();

    const profileResp = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileResp.ok) return res.redirect(`${process.env.FRONTEND_URL}/login?error=profile_fetch_failed`);
    const profile = await profileResp.json();

    const email = (profile.mail || profile.userPrincipalName || '').toLowerCase();
    if (!email) return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`);

    let user = await prisma.staffUser.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.staffUser.create({
        data: { email, nom: profile.surname || '', prenom: profile.givenName || '', azureId: profile.id || null },
      });
      await logAction(null, 'SSO_ACCOUNT_CREATED', { email });
    } else if (!user.azureId && profile.id) {
      user = await prisma.staffUser.update({ where: { id: user.id }, data: { azureId: profile.id } });
    }

    if (!user.active) return res.redirect(`${process.env.FRONTEND_URL}/login?error=account_disabled`);

    const jwtToken = issueToken(user);
    await logAction(user.id, 'SSO_LOGIN', { email });
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${jwtToken}`);
  } catch (err) {
    next(err);
  }
}

// Compte de secours local — comparaison directe aux identifiants seedés,
// sans mot de passe stocké en base (cohérent avec le schéma StaffUser, aucun
// champ passwordHash — même approche que les autres modules KORINTEK).
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });

    const expectedEmail = (process.env.SEED_ADMIN_EMAIL || '').toLowerCase();
    const expectedPassword = process.env.SEED_ADMIN_PASSWORD;

    if (email.toLowerCase() !== expectedEmail || password !== expectedPassword) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const user = await prisma.staffUser.findUnique({ where: { email: expectedEmail } });
    if (!user || !user.active) return res.status(401).json({ error: 'Compte de secours introuvable ou désactivé.' });

    const token = issueToken(user);
    await logAction(user.id, 'LOCAL_LOGIN', { email: user.email });
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

module.exports = { microsoftLogin, microsoftCallback, login, me };

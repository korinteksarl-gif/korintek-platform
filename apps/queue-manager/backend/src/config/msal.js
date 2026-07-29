// Client confidentiel MSAL pour l'authentification Microsoft Entra ID (Office 365)
// Réutilise l'app registration existante "KORINTEK Facturation" — même tenant, même client ID.
const { ConfidentialClientApplication } = require('@azure/msal-node');

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
};

const msalClient = new ConfidentialClientApplication(msalConfig);

const SCOPES = ['openid', 'profile', 'email', 'User.Read'];

module.exports = { msalClient, SCOPES };

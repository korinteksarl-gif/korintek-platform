// Réutilise la même app registration Azure que le Queue Manager et facturation.korintek.com.
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

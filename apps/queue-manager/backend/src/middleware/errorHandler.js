// Gestion centralisée des erreurs — évite les fuites de stack trace en production
function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Une ressource unique existe déjà (doublon).' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Ressource introuvable.' });
  }

  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'Erreur interne du serveur.'
      : err.message || 'Erreur interne du serveur.';

  res.status(status).json({ error: message });
}

module.exports = errorHandler;

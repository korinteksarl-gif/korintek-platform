const express = require('express');
const { issue, downloadPdf, verify, list, archive, remove } = require('../controllers/certificates.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const { verifyLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Public — vérification d'authenticité et téléchargement du PDF (le PDF lui-même
// reste consultable via son numéro, comme un vrai certificat papier vérifiable)
router.get('/verify/:numero', verifyLimiter, verify);
router.get('/:numero/pdf', verifyLimiter, downloadPdf);

router.use(authenticate);
router.get('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'TRAINER']), list);
router.post('/issue', requireRole(['SUPER_ADMIN', 'ADMIN', 'TRAINER']), issue);

// Archivage réservé à l'équipe d'administration.
router.post('/:numero/archive', requireRole(['SUPER_ADMIN', 'ADMIN']), archive);

// Suppression définitive réservée au SUPER_ADMIN et uniquement après archivage.
router.delete('/:numero', requireRole(['SUPER_ADMIN']), remove);

module.exports = router;

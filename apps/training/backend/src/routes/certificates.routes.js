const express = require('express');
const { issue, downloadPdf, verify, list } = require('../controllers/certificates.controller');
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

module.exports = router;

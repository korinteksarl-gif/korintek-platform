const express = require('express');
const { grandLivre, balance, bilan } = require('../controllers/reports.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);
router.get('/grand-livre/:accountId', requireRole(['SUPER_ADMIN', 'ADMIN', 'COMPTABLE']), grandLivre);
router.get('/balance', requireRole(['SUPER_ADMIN', 'ADMIN', 'COMPTABLE']), balance);
router.get('/bilan', requireRole(['SUPER_ADMIN', 'ADMIN', 'COMPTABLE']), bilan);

module.exports = router;

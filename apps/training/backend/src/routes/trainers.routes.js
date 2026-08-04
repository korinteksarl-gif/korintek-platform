const express = require('express');
const { list, create, update, updateSessionPayment } = require('../controllers/trainers.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);
router.get('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE']), list);
router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN']), create);
router.put('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), update);
router.put('/sessions/:sessionId/payment', requireRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE']), updateSessionPayment);

module.exports = router;

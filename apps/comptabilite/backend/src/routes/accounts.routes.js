const express = require('express');
const { list, create, update } = require('../controllers/accounts.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);
router.get('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'COMPTABLE']), list);
router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN']), create);
router.put('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), update);

module.exports = router;

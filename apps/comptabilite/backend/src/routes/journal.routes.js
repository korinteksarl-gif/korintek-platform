const express = require('express');
const { list, getOne, create, remove } = require('../controllers/journal.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);
router.get('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'COMPTABLE']), list);
router.get('/:id', requireRole(['SUPER_ADMIN', 'ADMIN', 'COMPTABLE']), getOne);
router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'COMPTABLE']), create);
router.delete('/:id', requireRole(['SUPER_ADMIN']), remove);

module.exports = router;

const express = require('express');
const { list, stats, create, update, remove } = require('../controllers/candidates.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', list);
router.get('/stats', stats);
router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'RECEPTION']), create);
router.put('/:id', requireRole(['SUPER_ADMIN', 'ADMIN', 'RECEPTION']), update);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), remove);

module.exports = router;

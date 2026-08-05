const express = require('express');
const {
  list, getOne, create, update, remove, addInteraction, stats,
} = require('../controllers/contacts.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);
router.get('/stats', requireRole(['SUPER_ADMIN', 'ADMIN', 'SALES']), stats);
router.get('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'SALES']), list);
router.get('/:id', requireRole(['SUPER_ADMIN', 'ADMIN', 'SALES']), getOne);
router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'SALES']), create);
router.put('/:id', requireRole(['SUPER_ADMIN', 'ADMIN', 'SALES']), update);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), remove);
router.post('/:contactId/interactions', requireRole(['SUPER_ADMIN', 'ADMIN', 'SALES']), addInteraction);

module.exports = router;

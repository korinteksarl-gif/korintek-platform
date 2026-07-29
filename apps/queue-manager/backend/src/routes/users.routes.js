const express = require('express');
const { list, updateRole, toggleActive, remove } = require('../controllers/users.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole(['SUPER_ADMIN']));

router.get('/', list);
router.put('/:id/role', updateRole);
router.put('/:id/active', toggleActive);
router.delete('/:id', remove);

module.exports = router;

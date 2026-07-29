const express = require('express');
const { list, updateRole, toggleActive } = require('../controllers/users.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole(['SUPER_ADMIN']));

router.get('/', list);
router.put('/:id/role', updateRole);
router.put('/:id/active', toggleActive);

module.exports = router;

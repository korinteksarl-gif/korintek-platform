const express = require('express');
const { list, update } = require('../controllers/users.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);
router.get('/', requireRole(['SUPER_ADMIN']), list);
router.put('/:id', requireRole(['SUPER_ADMIN']), update);

module.exports = router;

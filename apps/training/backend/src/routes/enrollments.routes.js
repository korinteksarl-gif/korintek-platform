const express = require('express');
const { createPublic, createStaff, list, update, remove } = require('../controllers/enrollments.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public — inscription en ligne par l'étudiant
router.post('/public', createPublic);

router.use(authenticate);
router.get('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'TRAINER']), list);
router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN']), createStaff);
router.put('/:id', requireRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'TRAINER']), update);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), remove);

module.exports = router;

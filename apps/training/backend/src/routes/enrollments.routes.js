const express = require('express');
const { createPublic, createStaff, list, update, remove } = require('../controllers/enrollments.controller');
const { authenticate, requireRole } = require('../middleware/auth');
const { enrollmentLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Public — inscription en ligne par l'étudiant, protégée contre le spam
router.post('/public', enrollmentLimiter, createPublic);

router.use(authenticate);
router.get('/', requireRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'TRAINER']), list);
router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN']), createStaff);
router.put('/:id', requireRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'TRAINER']), update);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), remove);

module.exports = router;

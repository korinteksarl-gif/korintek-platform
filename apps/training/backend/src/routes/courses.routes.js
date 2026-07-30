const express = require('express');
const {
  listPublic, listAll, create, update, remove, createSession, updateSession,
} = require('../controllers/courses.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public — catalogue consulté par les étudiants
router.get('/', listPublic);

router.use(authenticate);
router.get('/admin', requireRole(['SUPER_ADMIN', 'ADMIN']), listAll);
router.post('/', requireRole(['SUPER_ADMIN', 'ADMIN']), create);
router.put('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), update);
router.delete('/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), remove);
router.post('/:courseId/sessions', requireRole(['SUPER_ADMIN', 'ADMIN']), createSession);
router.put('/sessions/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), updateSession);

module.exports = router;

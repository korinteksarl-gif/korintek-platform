const express = require('express');
const { current, callNext, complete, markAbsent } = require('../controllers/queue.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// L'écran public /display consomme /current sans authentification (lecture seule)
router.get('/current', current);

router.use(authenticate);
router.post('/next', requireRole(['SUPER_ADMIN', 'ADMIN', 'RECEPTION', 'EXAM_CENTER_AGENT']), callNext);
router.post('/:id/complete', requireRole(['SUPER_ADMIN', 'ADMIN', 'RECEPTION', 'EXAM_CENTER_AGENT']), complete);
router.post('/:id/absent', requireRole(['SUPER_ADMIN', 'ADMIN', 'RECEPTION', 'EXAM_CENTER_AGENT']), markAbsent);

module.exports = router;

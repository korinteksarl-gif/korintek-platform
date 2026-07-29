const express = require('express');
const {
  current,
  admissionCurrent,
  admissionList,
  publicStats,
  callNext,
  replayCall,
  complete,
  markAbsent,
} = require('../controllers/queue.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// Routes publiques — consommées par l'écran /display sans authentification
router.get('/current', current);
router.get('/admission-current', admissionCurrent);
router.get('/public-stats', publicStats);

router.use(authenticate);
router.get('/admission-list', requireRole(['SUPER_ADMIN', 'ADMIN', 'RECEPTION', 'EXAM_CENTER_AGENT']), admissionList);
router.post('/next', requireRole(['SUPER_ADMIN', 'ADMIN', 'RECEPTION', 'EXAM_CENTER_AGENT']), callNext);
router.post('/:id/replay-call', requireRole(['SUPER_ADMIN', 'ADMIN', 'RECEPTION', 'EXAM_CENTER_AGENT']), replayCall);
router.post('/:id/complete', requireRole(['SUPER_ADMIN', 'ADMIN', 'RECEPTION', 'EXAM_CENTER_AGENT']), complete);
router.post('/:id/absent', requireRole(['SUPER_ADMIN', 'ADMIN', 'RECEPTION', 'EXAM_CENTER_AGENT']), markAbsent);

module.exports = router;

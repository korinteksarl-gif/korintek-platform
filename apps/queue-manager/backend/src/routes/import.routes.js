const express = require('express');
const multer = require('multer');
const { importCandidates } = require('../controllers/import.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = express.Router();

router.use(authenticate);
router.post(
  '/candidates',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'RECEPTION']),
  upload.single('file'),
  importCandidates
);

module.exports = router;

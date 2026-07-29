const express = require('express');
const multer = require('multer');
const { listActive, listAll, create, update, remove } = require('../controllers/ads.controller');
const { authenticate, requireRole } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 } });
const router = express.Router();

// Route publique — consommée par l'écran /display, sans authentification
router.get('/', listActive);

// Routes de gestion — réservées ADMIN / SUPER_ADMIN
router.get('/admin', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), listAll);
router.post('/', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), upload.single('file'), create);
router.put('/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), update);
router.delete('/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), remove);

module.exports = router;

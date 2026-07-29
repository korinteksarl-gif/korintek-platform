const express = require('express');
const multer = require('multer');
const { listActive, listAll, create, update, remove } = require('../controllers/ads.controller');
const { authenticate, requireRole } = require('../middleware/auth');

// Images ET vidéos courtes sont acceptées (le format est déduit du type MIME et stocké
// tel quel en base64 — le frontend choisit <img> ou <video> selon le préfixe détecté).
// Limite relevée à 15 Mo pour permettre de courtes vidéos en boucle (quelques secondes).
// À garder raisonnable : le stockage Neon.tech gratuit est plafonné à 0.5 Go au total.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers image ou vidéo sont acceptés.'));
    }
  },
});
const router = express.Router();

// Route publique — consommée par l'écran /display, sans authentification
router.get('/', listActive);

// Routes de gestion — réservées ADMIN / SUPER_ADMIN
router.get('/admin', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), listAll);
router.post('/', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), upload.single('file'), create);
router.put('/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), update);
router.delete('/:id', authenticate, requireRole(['SUPER_ADMIN', 'ADMIN']), remove);

module.exports = router;

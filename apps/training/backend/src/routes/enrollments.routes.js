const express = require('express');

const {
  createPublic,
  createStaff,
  list,
  update,
  remove,
} = require('../controllers/enrollments.controller');

const {
  authenticate,
  requireRole,
} = require('../middleware/auth');

const {
  enrollmentLimiter,
} = require('../middleware/rateLimit');

const router = express.Router();

// ============================================================
// INSCRIPTION PUBLIQUE
// ============================================================
// POST /api/v1/enrollments/public
// Accessible sans authentification
router.post(
  '/public',
  enrollmentLimiter,
  createPublic
);

// ============================================================
// ROUTES STAFF
// ============================================================
// Toutes les routes suivantes nécessitent une authentification
router.use(authenticate);

// Liste des inscriptions
router.get(
  '/',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'TRAINER']),
  list
);

// Création d'une inscription par le staff
router.post(
  '/',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  createStaff
);

// Modification d'une inscription
router.put(
  '/:id',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'TRAINER']),
  update
);

// Suppression d'une inscription
router.delete(
  '/:id',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  remove
);

// ============================================================
// EXPORT
// ============================================================
module.exports = router;

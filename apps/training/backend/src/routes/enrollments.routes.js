const express = require('express');

const {
  createPublic,
  createStaff,
  list,
  update,
  updateStudent,
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
// PUBLIC
// ============================================================

// Inscription en ligne par l'étudiant
// Protégée contre le spam
router.post(
  '/public',
  enrollmentLimiter,
  createPublic
);

// ============================================================
// ROUTES PROTÉGÉES
// ============================================================

router.use(authenticate);

// ============================================================
// LISTE
// ============================================================

router.get(
  '/',
  requireRole([
    'SUPER_ADMIN',
    'ADMIN',
    'FINANCE',
    'TRAINER',
  ]),
  list
);

// ============================================================
// CRÉATION
// ============================================================

router.post(
  '/',
  requireRole([
    'SUPER_ADMIN',
    'ADMIN',
  ]),
  createStaff
);

// ============================================================
// CORRECTION DES INFORMATIONS APPRENANT
// IMPORTANT : cette route doit être AVANT /:id
// ============================================================

router.put(
  '/:id/student',
  requireRole([
    'SUPER_ADMIN',
    'ADMIN',
  ]),
  updateStudent
);

// ============================================================
// MODIFICATION DE L'INSCRIPTION
// Statut / paiement / session / notes
// ============================================================

router.put(
  '/:id',
  requireRole([
    'SUPER_ADMIN',
    'ADMIN',
    'FINANCE',
    'TRAINER',
  ]),
  update
);

// ============================================================
// SUPPRESSION
// ============================================================

router.delete(
  '/:id',
  requireRole([
    'SUPER_ADMIN',
    'ADMIN',
  ]),
  remove
);

module.exports = router;

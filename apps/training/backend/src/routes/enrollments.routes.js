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

// Liste des inscriptions
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

// Création d'une inscription par l'équipe
router.post(
  '/',
  requireRole([
    'SUPER_ADMIN',
    'ADMIN',
  ]),
  createStaff
);

// Modification d'une inscription
// Statut / paiement / session / notes
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
// CORRECTION DES INFORMATIONS APPRENANT
// ============================================================

// Modification du nom, prénom, email et téléphone
// Seuls SUPER_ADMIN et ADMIN peuvent le faire
router.put(
  '/:id/student',
  requireRole([
    'SUPER_ADMIN',
    'ADMIN',
  ]),
  updateStudent
);

// Suppression
router.delete(
  '/:id',
  requireRole([
    'SUPER_ADMIN',
    'ADMIN',
  ]),
  remove
);

module.exports = router;

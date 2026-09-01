const express = require('express');

const {
  createPublic,
  createStaff,
  list,
  update,
  updateStudent,
  remove,
} = require('../controllers/enrollments.controller');

const { authenticate, requireRole } = require('../middleware/auth');
const { enrollmentLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// ============================================================
// PUBLIC — inscription en ligne
// ============================================================

router.post(
  '/public',
  enrollmentLimiter,
  createPublic
);

// ============================================================
// ROUTES STAFF — authentification obligatoire
// ============================================================

router.use(authenticate);

// Liste des inscriptions
router.get(
  '/',
  requireRole(['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'TRAINER']),
  list
);

// Nouvelle inscription saisie par l'équipe
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

// ============================================================
// MODIFICATION DES INFORMATIONS DE L'APPRENANT
// ============================================================
//
// Cette route modifie le Student lié à l'inscription :
// - prénom
// - nom
// - email
// - téléphone
//
// Elle ne modifie PAS le paiement, le statut ou la formation.
//

router.put(
  '/:id/student',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  updateStudent
);

// Suppression d'une inscription
router.delete(
  '/:id',
  requireRole(['SUPER_ADMIN', 'ADMIN']),
  remove
);

module.exports = router;

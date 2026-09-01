const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

// ============================================================
// UTILITAIRES
// ============================================================

function sanitizeText(value, maxLength = 200) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Recherche ou création d'un apprenant
async function findOrCreateStudent({ nom, prenom, email, telephone }) {
  if (email) {
    const existing = await prisma.student.findFirst({
      where: { email },
    });

    if (existing) {
      return existing;
    }
  }

  return prisma.student.create({
    data: {
      nom,
      prenom,
      email: email || null,
      telephone: telephone || null,
    },
  });
}

// ============================================================
// INSCRIPTION PUBLIQUE
// ============================================================

// POST /api/v1/enrollments/public
async function createPublic(req, res, next) {
  try {
    const nom = sanitizeText(req.body.nom, 100);
    const prenom = sanitizeText(req.body.prenom, 100);
    const emailRaw = sanitizeText(req.body.email, 150);
    const telephone = sanitizeText(req.body.telephone, 30);
    const courseId = sanitizeText(req.body.courseId, 60);
    const sessionId = sanitizeText(req.body.sessionId, 60);

    if (!nom || !prenom || !courseId) {
      return res.status(400).json({
        error: 'Nom, prénom et formation sont requis.',
      });
    }

    if (emailRaw && !EMAIL_RE.test(emailRaw)) {
      return res.status(400).json({
        error: "Format d'email invalide.",
      });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course || !course.active) {
      return res.status(404).json({
        error: 'Formation introuvable ou indisponible.',
      });
    }

    const student = await findOrCreateStudent({
      nom,
      prenom,
      email: emailRaw || null,
      telephone: telephone || null,
    });

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId,
        sessionId: sessionId || null,
        enrolledVia: 'SELF',
        amountDue: course.price,
      },
    });

    await logAction(
      null,
      'PUBLIC_ENROLLMENT_CREATED',
      {
        enrollmentId: enrollment.id,
        courseId,
      }
    );

    res.status(201).json({ enrollment });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// INSCRIPTION STAFF
// ============================================================

// POST /api/v1/enrollments
async function createStaff(req, res, next) {
  try {
    const {
      nom,
      prenom,
      email,
      telephone,
      courseId,
      sessionId,
      paymentMethod,
      amountPaid,
      notes,
    } = req.body;

    if (!nom || !prenom || !courseId) {
      return res.status(400).json({
        error: 'Nom, prénom et formation sont requis.',
      });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return res.status(404).json({
        error: 'Formation introuvable.',
      });
    }

    const student = await findOrCreateStudent({
      nom,
      prenom,
      email,
      telephone,
    });

    const paid = Number(amountPaid) || 0;

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId,
        sessionId: sessionId || null,
        enrolledVia: 'STAFF',
        amountDue: course.price,
        amountPaid: paid,
        paymentMethod: paymentMethod || null,
        statut:
          paid >= course.price && course.price > 0
            ? 'PAID'
            : paid > 0
              ? 'PAYMENT_PARTIAL'
              : 'PENDING',
        notes: notes || null,
      },
    });

    await logAction(
      req.user?.id,
      'STAFF_ENROLLMENT_CREATED',
      {
        enrollmentId: enrollment.id,
        courseId,
      }
    );

    res.status(201).json({ enrollment });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// LISTE DES INSCRIPTIONS
// ============================================================

// GET /api/v1/enrollments
async function list(req, res, next) {
  try {
    const { statut, courseId } = req.query;

    const where = {};

    if (statut) {
      where.statut = statut;
    }

    if (courseId) {
      where.courseId = courseId;
    }

    const enrollments = await prisma.enrollment.findMany({
      where,
      include: {
        student: true,
        course: true,
        session: true,
        certificate: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ enrollments });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// MODIFICATION INSCRIPTION
// ============================================================

// PUT /api/v1/enrollments/:id
//
// Modification de :
// - statut
// - paiement
// - session
// - notes
async function update(req, res, next) {
  try {
    const { id } = req.params;

    const {
      statut,
      paymentMethod,
      amountPaid,
      sessionId,
      notes,
    } = req.body;

    // Sécurité : seul SUPER_ADMIN peut modifier le montant payé
    if (
      amountPaid !== undefined &&
      req.user?.role !== 'SUPER_ADMIN'
    ) {
      return res.status(403).json({
        error:
          'Seul un SUPER_ADMIN peut modifier le montant payé.',
      });
    }

    const enrollment = await prisma.enrollment.update({
      where: { id },

      data: {
        ...(statut !== undefined && {
          statut,
        }),

        ...(paymentMethod !== undefined && {
          paymentMethod,
        }),

        ...(amountPaid !== undefined && {
          amountPaid: Number(amountPaid),
        }),

        ...(sessionId !== undefined && {
          sessionId: sessionId || null,
        }),

        ...(notes !== undefined && {
          notes,
        }),
      },

      include: {
        student: true,
        course: true,
        session: true,
        certificate: true,
      },
    });

    await logAction(
      req.user?.id,
      'ENROLLMENT_UPDATED',
      {
        enrollmentId: id,
        statut,
        paymentMethod,
        amountPaid,
      }
    );

    res.json({ enrollment });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// CORRECTION DES INFORMATIONS DE L'APPRENANT
// ============================================================
//
// PUT /api/v1/enrollments/:id/student
//
// Cette fonction corrige :
// - nom
// - prénom
// - email
// - téléphone
//
// ET synchronise automatiquement le nom présent
// dans l'attestation existante.
//
// ============================================================

async function updateStudent(req, res, next) {
  try {
    const { id } = req.params;

    const nom =
      req.body.nom !== undefined
        ? sanitizeText(req.body.nom, 100)
        : undefined;

    const prenom =
      req.body.prenom !== undefined
        ? sanitizeText(req.body.prenom, 100)
        : undefined;

    const email =
      req.body.email !== undefined
        ? sanitizeText(req.body.email, 150)
        : undefined;

    const telephone =
      req.body.telephone !== undefined
        ? sanitizeText(req.body.telephone, 30)
        : undefined;

    // ----------------------------------------------------------
    // Validation
    // ----------------------------------------------------------

    if (
      nom !== undefined &&
      !nom
    ) {
      return res.status(400).json({
        error: 'Le nom ne peut pas être vide.',
      });
    }

    if (
      prenom !== undefined &&
      !prenom
    ) {
      return res.status(400).json({
        error: 'Le prénom ne peut pas être vide.',
      });
    }

    if (
      email !== undefined &&
      email &&
      !EMAIL_RE.test(email)
    ) {
      return res.status(400).json({
        error: "Format d'email invalide.",
      });
    }

    // ----------------------------------------------------------
    // Vérifier l'inscription
    // ----------------------------------------------------------

    const existingEnrollment =
      await prisma.enrollment.findUnique({
        where: { id },

        include: {
          student: true,
          certificate: true,
          course: true,
        },
      });

    if (!existingEnrollment) {
      return res.status(404).json({
        error: 'Inscription introuvable.',
      });
    }

    // ----------------------------------------------------------
    // Construire les nouvelles données
    // ----------------------------------------------------------

    const studentData = {};

    if (nom !== undefined) {
      studentData.nom = nom;
    }

    if (prenom !== undefined) {
      studentData.prenom = prenom;
    }

    if (email !== undefined) {
      studentData.email = email || null;
    }

    if (telephone !== undefined) {
      studentData.telephone = telephone || null;
    }

    // Rien à modifier
    if (Object.keys(studentData).length === 0) {
      return res.status(400).json({
        error: 'Aucune information à modifier.',
      });
    }

    // ----------------------------------------------------------
    // Transaction
    // ----------------------------------------------------------

    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Modifier l'apprenant
        const student =
          await tx.student.update({
            where: {
              id: existingEnrollment.studentId,
            },

            data: studentData,
          });

        // 2. Synchroniser l'attestation existante
        let certificate = null;

        if (existingEnrollment.certificate) {
          const fullName =
            `${student.prenom} ${student.nom}`.trim();

          certificate =
            await tx.certificate.update({
              where: {
                id: existingEnrollment.certificate.id,
              },

              data: {
                studentNameSnapshot: fullName,

                // Le hash sera recalculé au moment de
                // la génération du PDF si cette logique
                // est présente dans certificates.controller.js.
                //
                // On ne modifie donc PAS certificateHash ici.
              },
            });
        }

        return {
          student,
          certificate,
        };
      }
    );

    // ----------------------------------------------------------
    // Audit
    // ----------------------------------------------------------

    await logAction(
      req.user?.id,
      'STUDENT_UPDATED',
      {
        enrollmentId: id,
        studentId: existingEnrollment.studentId,
        certificateId:
          existingEnrollment.certificate?.id || null,
        changes: {
          nom,
          prenom,
          email,
          telephone,
        },
      }
    );

    // ----------------------------------------------------------
    // Réponse
    // ----------------------------------------------------------

    res.json({
      message:
        'Informations de l’apprenant mises à jour avec succès.',
      student: result.student,
      certificate: result.certificate,
    });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// SUPPRESSION
// ============================================================

// DELETE /api/v1/enrollments/:id
async function remove(req, res, next) {
  try {
    const { id } = req.params;

    await prisma.enrollment.delete({
      where: { id },
    });

    await logAction(
      req.user?.id,
      'ENROLLMENT_DELETED',
      {
        enrollmentId: id,
      }
    );

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createPublic,
  createStaff,
  list,
  update,
  updateStudent,
  remove,
};

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

async function findOrCreateStudent({ nom, prenom, email, telephone }) {
  if (email) {
    const existing = await prisma.student.findFirst({
      where: { email },
    });

    if (existing) return existing;
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
// POST /api/v1/enrollments/public
// ============================================================

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
// POST /api/v1/enrollments
// ============================================================

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

    let statut = 'PENDING';

    if (course.price > 0 && paid >= course.price) {
      statut = 'PAID';
    } else if (paid > 0) {
      statut = 'PAYMENT_PARTIAL';
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        courseId,
        sessionId: sessionId || null,
        enrolledVia: 'STAFF',
        amountDue: course.price,
        amountPaid: paid,
        paymentMethod: paymentMethod || null,
        statut,
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
// GET /api/v1/enrollments
// ============================================================

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
// PUT /api/v1/enrollments/:id
//
// Paiement / statut / session / notes
// ============================================================

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

    // Seul SUPER_ADMIN peut modifier le montant payé
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
// CORRECTION DES INFORMATIONS APPRENANT
// PUT /api/v1/enrollments/:id/student
//
// Modification de :
// - nom
// - prénom
// - email
// - téléphone
//
// IMPORTANT :
// Si une attestation existe déjà, son nom est automatiquement
// synchronisé avec le nouveau nom de l'apprenant.
// ============================================================

async function updateStudent(req, res, next) {
  try {
    const { id } = req.params;

    const {
      nom,
      prenom,
      email,
      telephone,
    } = req.body;

    // ----------------------------------------------------------
    // Vérification
    // ----------------------------------------------------------

    if (
      nom === undefined &&
      prenom === undefined &&
      email === undefined &&
      telephone === undefined
    ) {
      return res.status(400).json({
        error: 'Aucune information à modifier.',
      });
    }

    if (
      email !== undefined &&
      email !== null &&
      email !== '' &&
      !EMAIL_RE.test(email)
    ) {
      return res.status(400).json({
        error: "Format d'email invalide.",
      });
    }

    // ----------------------------------------------------------
    // Récupérer l'inscription + étudiant + attestation
    // ----------------------------------------------------------

    const enrollment = await prisma.enrollment.findUnique({
      where: { id },

      include: {
        student: true,
        certificate: true,
      },
    });

    if (!enrollment) {
      return res.status(404).json({
        error: 'Inscription introuvable.',
      });
    }

    const studentId = enrollment.studentId;

    // ----------------------------------------------------------
    // Mise à jour de l'étudiant
    // ----------------------------------------------------------

    const student = await prisma.student.update({
      where: {
        id: studentId,
      },

      data: {
        ...(nom !== undefined && {
          nom: sanitizeText(nom, 100),
        }),

        ...(prenom !== undefined && {
          prenom: sanitizeText(prenom, 100),
        }),

        ...(email !== undefined && {
          email: email
            ? sanitizeText(email, 150)
            : null,
        }),

        ...(telephone !== undefined && {
          telephone: telephone
            ? sanitizeText(telephone, 30)
            : null,
        }),
      },
    });

    // ----------------------------------------------------------
    // NOUVEAU NOM COMPLET
    // ----------------------------------------------------------

    const studentNameSnapshot =
      `${student.prenom} ${student.nom}`.trim();

    // ----------------------------------------------------------
    // SYNCHRONISATION DE L'ATTESTATION
    // ----------------------------------------------------------

    if (enrollment.certificate) {
      await prisma.certificate.update({
        where: {
          id: enrollment.certificate.id,
        },

        data: {
          studentNameSnapshot,
        },
      });
    }

    // ----------------------------------------------------------
    // AUDIT
    // ----------------------------------------------------------

    await logAction(
      req.user?.id,
      'STUDENT_UPDATED',
      {
        enrollmentId: id,
        studentId,

        changes: {
          nom: nom !== undefined,
          prenom: prenom !== undefined,
          email: email !== undefined,
          telephone: telephone !== undefined,
        },

        certificateUpdated: Boolean(
          enrollment.certificate
        ),
      }
    );

    // ----------------------------------------------------------
    // Retourner l'inscription complète
    // ----------------------------------------------------------

    const updatedEnrollment =
      await prisma.enrollment.findUnique({
        where: { id },

        include: {
          student: true,
          course: true,
          session: true,
          certificate: true,
        },
      });

    res.json({
      enrollment: updatedEnrollment,
      student,
    });

  } catch (err) {
    next(err);
  }
}

// ============================================================
// SUPPRESSION
// DELETE /api/v1/enrollments/:id
// ============================================================

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

const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

// Validation légère des champs texte
function sanitizeText(value, maxLength = 200) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function findOrCreateStudent({ nom, prenom, email, telephone }) {
  // Correspondance simple par email si fourni
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

// GET /api/v1/enrollments
async function list(req, res, next) {
  try {
    const { statut, courseId } = req.query;

    const where = {};

    if (statut) where.statut = statut;
    if (courseId) where.courseId = courseId;

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

// PUT /api/v1/enrollments/:id
// Mise à jour statut / paiement / session / notes
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
        ...(statut !== undefined && { statut }),

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

// PUT /api/v1/enrollments/:id/student
// Correction des informations de l'apprenant
async function updateStudent(req, res, next) {
  try {
    const { id } = req.params;

    const nom = sanitizeText(req.body.nom, 100);
    const prenom = sanitizeText(req.body.prenom, 100);
    const emailRaw = sanitizeText(req.body.email, 150);
    const telephone = sanitizeText(req.body.telephone, 30);

    if (!nom || !prenom) {
      return res.status(400).json({
        error: 'Le nom et le prénom sont requis.',
      });
    }

    if (emailRaw && !EMAIL_RE.test(emailRaw)) {
      return res.status(400).json({
        error: "Format d'email invalide.",
      });
    }

    // On récupère l'inscription pour identifier l'étudiant
    const enrollment = await prisma.enrollment.findUnique({
      where: { id },
      include: {
        student: true,
      },
    });

    if (!enrollment) {
      return res.status(404).json({
        error: 'Inscription introuvable.',
      });
    }

    // Si un email est renseigné, vérifier qu'il n'appartient
    // pas déjà à un autre étudiant.
    if (emailRaw) {
      const existingStudent = await prisma.student.findFirst({
        where: {
          email: emailRaw,
          NOT: {
            id: enrollment.studentId,
          },
        },
      });

      if (existingStudent) {
        return res.status(409).json({
          error:
            'Cette adresse email est déjà associée à un autre apprenant.',
        });
      }
    }

    const student = await prisma.student.update({
      where: {
        id: enrollment.studentId,
      },

      data: {
        nom,
        prenom,
        email: emailRaw || null,
        telephone: telephone || null,
      },
    });

    await logAction(
      req.user?.id,
      'STUDENT_UPDATED',
      {
        studentId: student.id,
        enrollmentId: id,
        oldName: enrollment.student
          ? `${enrollment.student.prenom} ${enrollment.student.nom}`
          : null,
        newName: `${student.prenom} ${student.nom}`,
      }
    );

    res.json({
      student,
    });
  } catch (err) {
    next(err);
  }
}

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

module.exports = {
  createPublic,
  createStaff,
  list,
  update,
  updateStudent,
  remove,
};

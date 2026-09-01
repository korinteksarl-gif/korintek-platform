const crypto = require('crypto');
const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

function sanitizeText(value, maxLength = 200) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Format date YYYY-MM-DD sans dépendre du timezone du serveur.
 */
function formatDateForHash(date) {
  if (!date) return '';

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return '';
  }

  return value.toISOString().slice(0, 10);
}

/**
 * Hash utilisé par les nouveaux certificats.
 *
 * IMPORTANT :
 * Il doit rester identique à celui utilisé dans
 * certificates.controller.js.
 */
function computeCertificateHash({
  numero,
  studentName,
  courseTitle,
  durationHours,
  trainingStartDate,
  completionDate,
}) {
  const payload = [
    numero,
    studentName,
    courseTitle,
    durationHours,
    formatDateForHash(trainingStartDate),
    formatDateForHash(completionDate),
  ].join('|');

  return crypto
    .createHash('sha256')
    .update(payload)
    .digest('hex');
}

/**
 * Ancien hash utilisé par les certificats historiques
 * qui ne possèdent pas de trainingStartDate.
 */
function computeLegacyCertificateHash({
  numero,
  studentName,
  courseTitle,
  durationHours,
  completionDate,
}) {
  const payload = [
    numero,
    studentName,
    courseTitle,
    durationHours,
    formatDateForHash(completionDate),
  ].join('|');

  return crypto
    .createHash('sha256')
    .update(payload)
    .digest('hex');
}

/**
 * Synchronise le nom d'un étudiant avec toutes ses attestations existantes.
 *
 * Le nom affiché dans le PDF est stocké dans studentNameSnapshot.
 * Lorsque le nom de l'étudiant est corrigé, il faut donc également
 * corriger ce snapshot et recalculer le SHA-256.
 */
async function synchronizeStudentCertificates(studentId, studentName) {
  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId,
    },
    include: {
      course: true,
      certificate: true,
    },
  });

  for (const enrollment of enrollments) {
    const certificate = enrollment.certificate;

    if (!certificate) {
      continue;
    }

    let certificateHash;

    // Certificat utilisant le nouveau système de hash
    if (certificate.trainingStartDate) {
      certificateHash = computeCertificateHash({
        numero: certificate.numero,
        studentName,
        courseTitle: certificate.courseTitleSnapshot,
        durationHours: certificate.durationHoursSnapshot,
        trainingStartDate: certificate.trainingStartDate,
        completionDate: certificate.completionDate,
      });
    } else {
      // Compatibilité avec les anciens certificats
      certificateHash = computeLegacyCertificateHash({
        numero: certificate.numero,
        studentName,
        courseTitle: certificate.courseTitleSnapshot,
        durationHours: certificate.durationHoursSnapshot,
        completionDate: certificate.completionDate,
      });
    }

    await prisma.certificate.update({
      where: {
        id: certificate.id,
      },
      data: {
        studentNameSnapshot: studentName,
        certificateHash,
      },
    });
  }
}

// -----------------------------------------------------------------------------
// FIND / CREATE STUDENT
// -----------------------------------------------------------------------------

async function findOrCreateStudent({
  nom,
  prenom,
  email,
  telephone,
}) {
  // Correspondance simple par email si fourni.
  if (email) {
    const existing = await prisma.student.findFirst({
      where: {
        email,
      },
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

// -----------------------------------------------------------------------------
// PUBLIC ENROLLMENT
// POST /api/v1/enrollments/public
// -----------------------------------------------------------------------------

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
      where: {
        id: courseId,
      },
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

    res.status(201).json({
      enrollment,
    });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// STAFF ENROLLMENT
// POST /api/v1/enrollments
// -----------------------------------------------------------------------------

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
      where: {
        id: courseId,
      },
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

    res.status(201).json({
      enrollment,
    });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// LIST
// GET /api/v1/enrollments
// -----------------------------------------------------------------------------

async function list(req, res, next) {
  try {
    const {
      statut,
      courseId,
    } = req.query;

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

    res.json({
      enrollments,
    });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// UPDATE
// PUT /api/v1/enrollments/:id
//
// Permet maintenant de modifier :
// - nom
// - prénom
// - email
// - téléphone
// - statut
// - paiement
// - session
// - notes
//
// Lorsqu'un nom/prénom est modifié, toutes les attestations existantes
// de l'étudiant sont automatiquement synchronisées.
// -----------------------------------------------------------------------------

async function update(req, res, next) {
  try {
    const {
      id,
    } = req.params;

    const {
      nom,
      prenom,
      email,
      telephone,
      statut,
      paymentMethod,
      amountPaid,
      sessionId,
      notes,
    } = req.body;

    // -------------------------------------------------------------------------
    // CONTROLE DU MONTANT PAYE
    // -------------------------------------------------------------------------

    if (
      amountPaid !== undefined &&
      req.user?.role !== 'SUPER_ADMIN'
    ) {
      return res.status(403).json({
        error:
          'Seul un SUPER_ADMIN peut modifier le montant payé.',
      });
    }

    // -------------------------------------------------------------------------
    // RECUPERATION DE L'INSCRIPTION
    // -------------------------------------------------------------------------

    const existingEnrollment =
      await prisma.enrollment.findUnique({
        where: {
          id,
        },
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

    // -------------------------------------------------------------------------
    // PREPARATION DES DONNEES ETUDIANT
    // -------------------------------------------------------------------------

    const studentData = {};

    if (nom !== undefined) {
      const cleanNom = sanitizeText(nom, 100);

      if (!cleanNom) {
        return res.status(400).json({
          error: 'Le nom ne peut pas être vide.',
        });
      }

      studentData.nom = cleanNom;
    }

    if (prenom !== undefined) {
      const cleanPrenom = sanitizeText(prenom, 100);

      if (!cleanPrenom) {
        return res.status(400).json({
          error: 'Le prénom ne peut pas être vide.',
        });
      }

      studentData.prenom = cleanPrenom;
    }

    if (email !== undefined) {
      const cleanEmail = sanitizeText(email, 150);

      if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
        return res.status(400).json({
          error: "Format d'email invalide.",
        });
      }

      studentData.email = cleanEmail || null;
    }

    if (telephone !== undefined) {
      const cleanTelephone = sanitizeText(
        telephone,
        30
      );

      studentData.telephone =
        cleanTelephone || null;
    }

    // -------------------------------------------------------------------------
    // MISE A JOUR
    // -------------------------------------------------------------------------

    let updatedEnrollment;

    if (Object.keys(studentData).length > 0) {
      /*
       * Transaction :
       *
       * 1. modification de Student
       * 2. récupération de toutes les attestations
       * 3. mise à jour de studentNameSnapshot
       * 4. recalcul du hash
       * 5. mise à jour de l'inscription
       *
       * Si une étape échoue, Prisma annule la transaction.
       */

      updatedEnrollment =
        await prisma.$transaction(
          async (tx) => {
            const updatedStudent =
              await tx.student.update({
                where: {
                  id: existingEnrollment.studentId,
                },
                data: studentData,
              });

            const studentName =
              `${updatedStudent.prenom} ${updatedStudent.nom}`;

            // Toutes les inscriptions de cet étudiant.
            const studentEnrollments =
              await tx.enrollment.findMany({
                where: {
                  studentId:
                    updatedStudent.id,
                },
                include: {
                  certificate: true,
                },
              });

            // Synchronisation des certificats existants.
            for (
              const studentEnrollment
              of studentEnrollments
            ) {
              const certificate =
                studentEnrollment.certificate;

              if (!certificate) {
                continue;
              }

              let certificateHash;

              if (
                certificate.trainingStartDate
              ) {
                certificateHash =
                  computeCertificateHash({
                    numero:
                      certificate.numero,
                    studentName,
                    courseTitle:
                      certificate.courseTitleSnapshot,
                    durationHours:
                      certificate.durationHoursSnapshot,
                    trainingStartDate:
                      certificate.trainingStartDate,
                    completionDate:
                      certificate.completionDate,
                  });
              } else {
                certificateHash =
                  computeLegacyCertificateHash({
                    numero:
                      certificate.numero,
                    studentName,
                    courseTitle:
                      certificate.courseTitleSnapshot,
                    durationHours:
                      certificate.durationHoursSnapshot,
                    completionDate:
                      certificate.completionDate,
                  });
              }

              await tx.certificate.update({
                where: {
                  id: certificate.id,
                },
                data: {
                  studentNameSnapshot:
                    studentName,
                  certificateHash,
                },
              });
            }

            return tx.enrollment.update({
              where: {
                id,
              },
              data: {
                ...(statut !== undefined && {
                  statut,
                }),

                ...(paymentMethod !== undefined && {
                  paymentMethod:
                    paymentMethod || null,
                }),

                ...(amountPaid !== undefined && {
                  amountPaid:
                    Number(amountPaid),
                }),

                ...(sessionId !== undefined && {
                  sessionId:
                    sessionId || null,
                }),

                ...(notes !== undefined && {
                  notes: notes || null,
                }),
              },
              include: {
                student: true,
                course: true,
                session: true,
                certificate: true,
              },
            });
          }
        );
    } else {
      // Aucun changement d'identité :
      // comportement classique de mise à jour de l'inscription.

      updatedEnrollment =
        await prisma.enrollment.update({
          where: {
            id,
          },
          data: {
            ...(statut !== undefined && {
              statut,
            }),

            ...(paymentMethod !== undefined && {
              paymentMethod:
                paymentMethod || null,
            }),

            ...(amountPaid !== undefined && {
              amountPaid:
                Number(amountPaid),
            }),

            ...(sessionId !== undefined && {
              sessionId:
                sessionId || null,
            }),

            ...(notes !== undefined && {
              notes: notes || null,
            }),
          },
          include: {
            student: true,
            course: true,
            session: true,
            certificate: true,
          },
        });
    }

    // -------------------------------------------------------------------------
    // AUDIT
    // -------------------------------------------------------------------------

    await logAction(
      req.user?.id,
      'ENROLLMENT_UPDATED',
      {
        enrollmentId: id,
        statut,
        paymentMethod,
        amountPaid,
        studentUpdated:
          Object.keys(studentData).length > 0,
      }
    );

    res.json({
      enrollment: updatedEnrollment,
    });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// DELETE
// DELETE /api/v1/enrollments/:id
// -----------------------------------------------------------------------------

async function remove(req, res, next) {
  try {
    const {
      id,
    } = req.params;

    await prisma.enrollment.delete({
      where: {
        id,
      },
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

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------

module.exports = {
  createPublic,
  createStaff,
  list,
  update,
  remove,
};

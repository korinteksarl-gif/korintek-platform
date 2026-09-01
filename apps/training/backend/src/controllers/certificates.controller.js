const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const prisma = require('../config/db');
const { generateCertificateNumber } = require('../utils/certificateNumber');
const { logAction } = require('../utils/audit');

const BG_PATH = path.join(
  __dirname,
  '../assets/certificate_background.png'
);

const SERIF_PATH = path.join(
  __dirname,
  '../assets/cormorant-bold.ttf'
);

const SCALE = 72 / 150;
const PAGE_W = 1754 * SCALE;
const PAGE_H = 1240 * SCALE;

const SIGNATORY_NAME = 'Kodjo Tsogbe';
const SIGNATORY_TITLE = 'Directeur de la Formation';

// -----------------------------------------------------------------------------
// DATE HELPERS
// -----------------------------------------------------------------------------

function formatDate(date) {
  if (!date) return '';

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return '';
  }

  const months = [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ];

  return `${String(value.getUTCDate()).padStart(2, '0')} ${
    months[value.getUTCMonth()]
  } ${value.getUTCFullYear()}`;
}

/**
 * Retourne le mois et l'année en français.
 *
 * Exemple :
 * 03 août 2026 -> AOÛT 2026
 */
function formatMonthYear(date) {
  if (!date) return '';

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return '';
  }

  const months = [
    'JANVIER',
    'FÉVRIER',
    'MARS',
    'AVRIL',
    'MAI',
    'JUIN',
    'JUILLET',
    'AOÛT',
    'SEPTEMBRE',
    'OCTOBRE',
    'NOVEMBRE',
    'DÉCEMBRE',
  ];

  return `${months[value.getUTCMonth()]} ${value.getUTCFullYear()}`;
}

/**
 * Ajoute exactement un mois à une date.
 *
 * Exemple :
 * 03 août 2026 -> 03 septembre 2026
 */
function addOneMonth(date) {
  if (!date) return null;

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  const result = new Date(value);

  const originalDay = result.getUTCDate();

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);

  const lastDayOfTargetMonth = new Date(
    Date.UTC(
      result.getUTCFullYear(),
      result.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();

  result.setUTCDate(
    Math.min(
      originalDay,
      lastDayOfTargetMonth
    )
  );

  return result;
}

/**
 * Retourne une période lisible.
 *
 * Exemple :
 * AOÛT 2026 → SEPTEMBRE 2026
 */
function formatTrainingPeriod(startDate) {
  if (!startDate) return '';

  const start = formatMonthYear(startDate);
  const endDate = addOneMonth(startDate);
  const end = formatMonthYear(endDate);

  if (!start) return '';

  if (!end) {
    return start;
  }

  return `${start} → ${end}`;
}

/**
 * Format utilisé dans le hash.
 */
function formatDateForHash(date) {
  if (!date) return '';

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return '';
  }

  return value.toISOString().slice(0, 10);
}

// -----------------------------------------------------------------------------
// PDF HELPERS
// -----------------------------------------------------------------------------

function toPt(pxX, pxY) {
  return {
    x: pxX * SCALE,
    y: PAGE_H - pxY * SCALE,
  };
}

function drawCentered(
  page,
  text,
  font,
  size,
  y,
  color = rgb(0, 0, 0)
) {
  const width = font.widthOfTextAtSize(
    text,
    size
  );

  const x =
    (PAGE_W - width) / 2;

  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
  });
}

function drawFittedText({
  page,
  text,
  font,
  x,
  y,
  maxWidth,
  size,
  minSize = 10,
  color = rgb(0, 0, 0),
  align = 'left',
}) {
  let currentSize = size;

  while (
    currentSize > minSize &&
    font.widthOfTextAtSize(
      text,
      currentSize
    ) > maxWidth
  ) {
    currentSize -= 0.5;
  }

  const currentWidth =
    font.widthOfTextAtSize(
      text,
      currentSize
    );

  let currentX = x;

  if (align === 'center') {
    currentX =
      x + (maxWidth - currentWidth) / 2;
  }

  if (align === 'right') {
    currentX =
      x + maxWidth - currentWidth;
  }

  page.drawText(text, {
    x: currentX,
    y,
    size: currentSize,
    font,
    color,
  });

  return {
    size: currentSize,
    width: currentWidth,
  };
}

// -----------------------------------------------------------------------------
// SHA-256
// -----------------------------------------------------------------------------

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
 * Ancienne méthode de hash.
 *
 * Conservée pour les certificats créés avant l'ajout
 * de trainingStartDate.
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
 * Retourne le hash du certificat.
 *
 * IMPORTANT :
 * Si un studentName est fourni, celui-ci devient la source
 * de vérité. Cela permet de corriger les anciennes attestations
 * lorsque le nom/prénom de l'apprenant a été modifié.
 */
async function ensureHash(
  certificate,
  studentName = null
) {
  const effectiveStudentName =
    studentName ||
    certificate.studentNameSnapshot;

  let hash;

  if (certificate.trainingStartDate) {
    hash = computeCertificateHash({
      numero: certificate.numero,

      studentName:
        effectiveStudentName,

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
    // Compatibilité avec les anciens certificats.
    hash =
      computeLegacyCertificateHash({
        numero: certificate.numero,

        studentName:
          effectiveStudentName,

        courseTitle:
          certificate.courseTitleSnapshot,

        durationHours:
          certificate.durationHoursSnapshot,

        completionDate:
          certificate.completionDate,
      });
  }

  /*
   * Si le nom a été corrigé dans Student, ou si le hash
   * n'est plus cohérent, on synchronise le certificat.
   */
  if (
    certificate.studentNameSnapshot !==
      effectiveStudentName ||
    certificate.certificateHash !==
      hash
  ) {
    try {
      await prisma.certificate.update({
        where: {
          id: certificate.id,
        },

        data: {
          studentNameSnapshot:
            effectiveStudentName,

          certificateHash:
            hash,
        },
      });
    } catch (err) {
      console.error(
        'Impossible de synchroniser le certificat :',
        err.message
      );
    }
  }

  return hash;
}

// -----------------------------------------------------------------------------
// GENERATION PDF
// -----------------------------------------------------------------------------

async function generateCertificatePdf({
  studentName,
  courseTitle,
  durationHours,
  completionDate,
  trainingStartDate,
  numero,
  hash,
}) {
  const pdfDoc =
    await PDFDocument.create();

  pdfDoc.registerFontkit(fontkit);

  const page =
    pdfDoc.addPage([
      PAGE_W,
      PAGE_H,
    ]);

  // ---------------------------------------------------------------------------
  // BACKGROUND
  // ---------------------------------------------------------------------------

  if (fs.existsSync(BG_PATH)) {
    const backgroundBytes =
      fs.readFileSync(BG_PATH);

    const backgroundImage =
      await pdfDoc.embedPng(
        backgroundBytes
      );

    page.drawImage(
      backgroundImage,
      {
        x: 0,
        y: 0,
        width: PAGE_W,
        height: PAGE_H,
      }
    );
  }

  // ---------------------------------------------------------------------------
  // FONTS
  // ---------------------------------------------------------------------------

  const serifFontBytes =
    fs.readFileSync(SERIF_PATH);

  const serifFont =
    await pdfDoc.embedFont(
      serifFontBytes
    );

  const regularFont =
    await pdfDoc.embedFont(
      StandardFonts.Helvetica
    );

  const boldFont =
    await pdfDoc.embedFont(
      StandardFonts.HelveticaBold
    );

  // ---------------------------------------------------------------------------
  // COLORS
  // ---------------------------------------------------------------------------

  const navy =
    rgb(
      15 / 255,
      23 / 255,
      42 / 255
    );

  const teal =
    rgb(
      0 / 255,
      186 / 255,
      210 / 255
    );

  const slate =
    rgb(
      71 / 255,
      85 / 255,
      105 / 255
    );

  // ---------------------------------------------------------------------------
  // TITLE
  // ---------------------------------------------------------------------------

  drawCentered(
    page,
    'ATTESTATION DE FORMATION',
    boldFont,
    27,
    PAGE_H - 205 * SCALE,
    navy
  );

  // ---------------------------------------------------------------------------
  // INTRODUCTION
  // ---------------------------------------------------------------------------

  const intro =
    'KORINTEK SARL atteste que';

  drawCentered(
    page,
    intro,
    regularFont,
    12,
    PAGE_H - 270 * SCALE,
    slate
  );

  // ---------------------------------------------------------------------------
  // STUDENT NAME
  // ---------------------------------------------------------------------------

  drawFittedText({
    page,

    text:
      studentName || '',

    font:
      serifFont,

    x:
      150 * SCALE,

    y:
      PAGE_H - 335 * SCALE,

    maxWidth:
      PAGE_W - 300 * SCALE,

    size:
      31,

    minSize:
      20,

    color:
      navy,

    align:
      'center',
  });

  // ---------------------------------------------------------------------------
  // COURSE
  // ---------------------------------------------------------------------------

  drawCentered(
    page,
    'a suivi avec succès la formation',
    regularFont,
    12,
    PAGE_H - 390 * SCALE,
    slate
  );

  drawFittedText({
    page,

    text:
      courseTitle || '',

    font:
      boldFont,

    x:
      180 * SCALE,

    y:
      PAGE_H - 445 * SCALE,

    maxWidth:
      PAGE_W - 360 * SCALE,

    size:
      19,

    minSize:
      12,

    color:
      teal,

    align:
      'center',
  });

  // ---------------------------------------------------------------------------
  // DURATION
  // ---------------------------------------------------------------------------

  const durationText =
    `${durationHours || 0} heures`;

  drawCentered(
    page,
    durationText,
    regularFont,
    12,
    PAGE_H - 495 * SCALE,
    slate
  );

  // ---------------------------------------------------------------------------
  // TRAINING PERIOD
  // ---------------------------------------------------------------------------

  if (trainingStartDate) {
    const period =
      formatTrainingPeriod(
        trainingStartDate
      );

    drawCentered(
      page,
      `Période : ${period}`,
      regularFont,
      11,
      PAGE_H - 535 * SCALE,
      slate
    );
  }

  // ---------------------------------------------------------------------------
  // COMPLETION DATE
  // ---------------------------------------------------------------------------

  drawCentered(
    page,
    `Délivrée le ${formatDate(completionDate)}`,
    regularFont,
    11,
    PAGE_H - 575 * SCALE,
    slate
  );

  // ---------------------------------------------------------------------------
  // CERTIFICATE NUMBER
  // ---------------------------------------------------------------------------

  drawCentered(
    page,
    `N° ${numero}`,
    boldFont,
    11,
    PAGE_H - 625 * SCALE,
    navy
  );

  // ---------------------------------------------------------------------------
  // SIGNATORY
  // ---------------------------------------------------------------------------

  const signatureY =
    PAGE_H - 730 * SCALE;

  drawCentered(
    page,
    SIGNATORY_NAME,
    boldFont,
    13,
    signatureY,
    navy
  );

  drawCentered(
    page,
    SIGNATORY_TITLE,
    regularFont,
    10,
    signatureY - 20,
    slate
  );

  // ---------------------------------------------------------------------------
  // QR CODE
  // ---------------------------------------------------------------------------

  if (numero) {
    const verificationBaseUrl =
      process.env.FRONTEND_URL ||
      'https://korintek-training-frontend.onrender.com';

    const verificationUrl =
      `${verificationBaseUrl}/verifier?numero=${encodeURIComponent(numero)}`;

    try {
      const qrDataUrl =
        await QRCode.toDataURL(
          verificationUrl,
          {
            margin: 1,
            width: 220,
            errorCorrectionLevel: 'M',
          }
        );

      const qrBase64 =
        qrDataUrl.split(',')[1];

      const qrBytes =
        Buffer.from(
          qrBase64,
          'base64'
        );

      const qrImage =
        await pdfDoc.embedPng(
          qrBytes
        );

      const qrSize =
        100 * SCALE;

      page.drawImage(
        qrImage,
        {
          x:
            PAGE_W -
            qrSize -
            95 * SCALE,

          y:
            80 * SCALE,

          width:
            qrSize,

          height:
            qrSize,
        }
      );
    } catch (err) {
      console.error(
        'Impossible de générer le QR code :',
        err.message
      );
    }
  }

  // ---------------------------------------------------------------------------
  // HASH
  // ---------------------------------------------------------------------------

  if (hash) {
    const shortHash =
      hash.length > 24
        ? hash.substring(0, 24)
        : hash;

    page.drawText(
      `SHA-256 : ${shortHash}`,
      {
        x:
          90 * SCALE,

        y:
          75 * SCALE,

        size:
          7,

        font:
          regularFont,

        color:
          slate,
      }
    );
  }

  return await pdfDoc.save();
}

// -----------------------------------------------------------------------------
// ISSUE
// -----------------------------------------------------------------------------

async function issue(
  req,
  res,
  next
) {
  try {
    const {
      enrollmentId,
      completionDate,
    } = req.body;

    if (!enrollmentId) {
      return res.status(400).json({
        error:
          "L'identifiant de l'inscription est requis.",
      });
    }

    // -------------------------------------------------------------------------
    // INSCRIPTION
    // -------------------------------------------------------------------------

    const enrollment =
      await prisma.enrollment.findUnique({
        where: {
          id: enrollmentId,
        },

        include: {
          student: true,
          course: true,
          certificate: true,
          session: true,
        },
      });

    if (!enrollment) {
      return res.status(404).json({
        error:
          'Inscription introuvable.',
      });
    }

    if (enrollment.certificate) {
      return res.status(409).json({
        error:
          'Une attestation existe déjà pour cette inscription.',
      });
    }

    // -------------------------------------------------------------------------
    // PAIEMENT
    // -------------------------------------------------------------------------

    if (
      enrollment.amountPaid <
      enrollment.amountDue
    ) {
      return res.status(402).json({
        error:
          "Le paiement n'est pas complet. Impossible de délivrer l'attestation.",
      });
    }

    // -------------------------------------------------------------------------
    // SESSION DE FORMATION
    // -------------------------------------------------------------------------
    //
    // Priorité :
    // 1. session explicitement associée à l'inscription
    // 2. sinon première session active de la formation
    //
    // -------------------------------------------------------------------------

    let trainingSession =
      enrollment.session;

    if (!trainingSession) {
      trainingSession =
        await prisma.session.findFirst({
          where: {
            courseId:
              enrollment.courseId,

            active:
              true,
          },

          orderBy: {
            startDate:
              'asc',
          },
        });
    }

    if (
      !trainingSession ||
      !trainingSession.startDate
    ) {
      return res.status(400).json({
        error:
          "Impossible de délivrer l'attestation : aucune session de formation avec une date de début n'est disponible pour cette formation.",
      });
    }

    const trainingStartDate =
      trainingSession.startDate;

    // -------------------------------------------------------------------------
    // DATE D'OBTENTION
    // -------------------------------------------------------------------------

    const finalDate =
      completionDate
        ? new Date(completionDate)
        : new Date();

    if (
      Number.isNaN(
        finalDate.getTime()
      )
    ) {
      return res.status(400).json({
        error:
          "La date d'obtention fournie est invalide.",
      });
    }

    // -------------------------------------------------------------------------
    // NUMERO
    // -------------------------------------------------------------------------

    const numero =
      await generateCertificateNumber();

    // -------------------------------------------------------------------------
    // NOM ET FORMATION
    // -------------------------------------------------------------------------

    const studentName =
      `${enrollment.student.prenom} ${enrollment.student.nom}`;

    // -------------------------------------------------------------------------
    // SHA-256
    // -------------------------------------------------------------------------

    const hash =
      computeCertificateHash({
        numero,

        studentName,

        courseTitle:
          enrollment.course.title,

        durationHours:
          enrollment.course.durationHours,

        trainingStartDate,

        completionDate:
          finalDate,
      });

    // -------------------------------------------------------------------------
    // CREATION CERTIFICAT
    // -------------------------------------------------------------------------

    const certificate =
      await prisma.certificate.create({
        data: {
          enrollmentId,

          numero,

          studentNameSnapshot:
            studentName,

          courseTitleSnapshot:
            enrollment.course.title,

          durationHoursSnapshot:
            enrollment.course.durationHours,

          trainingStartDate,

          completionDate:
            finalDate,

          certificateHash:
            hash,
        },
      });

    // -------------------------------------------------------------------------
    // MARQUER L'INSCRIPTION COMME TERMINEE
    // -------------------------------------------------------------------------

    await prisma.enrollment.update({
      where: {
        id:
          enrollmentId,
      },

      data: {
        statut:
          'COMPLETED',
      },
    });

    await logAction(
      req.user?.id,

      'CERTIFICATE_ISSUED',

      {
        certificateId:
          certificate.id,

        certificateNumber:
          certificate.numero,

        enrollmentId,

        trainingStartDate,

        trainingPeriod:
          formatTrainingPeriod(
            trainingStartDate
          ),
      }
    );

    res.status(201).json({
      certificate,
    });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// DOWNLOAD PDF
// -----------------------------------------------------------------------------

async function downloadPdf(
  req,
  res,
  next
) {
  try {
    const {
      numero,
    } = req.params;

    /*
     * IMPORTANT :
     * On récupère l'apprenant actuel via Enrollment -> Student.
     *
     * Cela permet aux anciennes attestations de prendre en compte
     * une correction de nom/prénom effectuée après leur création.
     */
    const certificate =
      await prisma.certificate.findUnique({
        where: {
          numero,
        },

        include: {
          enrollment: {
            include: {
              student: true,
            },
          },
        },
      });

    if (!certificate) {
      return res.status(404).json({
        error:
          'Attestation introuvable.',
      });
    }

    // -------------------------------------------------------------------------
    // NOM ACTUEL DE L'APPRENANT
    // -------------------------------------------------------------------------

    const currentStudent =
      certificate.enrollment?.student;

    const currentStudentName =
      currentStudent
        ? `${currentStudent.prenom || ''} ${currentStudent.nom || ''}`.trim()
        : certificate.studentNameSnapshot;

    // -------------------------------------------------------------------------
    // HASH
    // -------------------------------------------------------------------------

    const hash =
      await ensureHash(
        certificate,
        currentStudentName
      );

    // -------------------------------------------------------------------------
    // GENERATION PDF
    // -------------------------------------------------------------------------

    const pdfBytes =
      await generateCertificatePdf({
        studentName:
          currentStudentName,

        courseTitle:
          certificate.courseTitleSnapshot,

        durationHours:
          certificate.durationHoursSnapshot,

        completionDate:
          certificate.completionDate,

        trainingStartDate:
          certificate.trainingStartDate,

        numero:
          certificate.numero,

        hash,
      });

    res.setHeader(
      'Content-Type',
      'application/pdf'
    );

    res.setHeader(
      'Content-Disposition',
      `inline; filename="${numero}.pdf"`
    );

    res.send(
      Buffer.from(pdfBytes)
    );
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// VERIFY
// -----------------------------------------------------------------------------

async function verify(
  req,
  res,
  next
) {
  try {
    const {
      numero,
    } = req.params;

    /*
     * On récupère également l'apprenant actuel.
     */
    const certificate =
      await prisma.certificate.findUnique({
        where: {
          numero,
        },

        include: {
          enrollment: {
            include: {
              student: true,
            },
          },
        },
      });

    if (!certificate) {
      return res.status(404).json({
        valid: false,

        error:
          'Aucune attestation ne correspond à ce numéro.',
      });
    }

    // -------------------------------------------------------------------------
    // NOM ACTUEL
    // -------------------------------------------------------------------------

    const currentStudent =
      certificate.enrollment?.student;

    const currentStudentName =
      currentStudent
        ? `${currentStudent.prenom || ''} ${currentStudent.nom || ''}`.trim()
        : certificate.studentNameSnapshot;

    // -------------------------------------------------------------------------
    // HASH ACTUEL
    // -------------------------------------------------------------------------

    const currentHash =
      await ensureHash(
        certificate,
        currentStudentName
      );

    // -------------------------------------------------------------------------
    // RECALCUL
    // -------------------------------------------------------------------------

    let recomputedHash;

    if (
      certificate.trainingStartDate
    ) {
      recomputedHash =
        computeCertificateHash({
          numero:
            certificate.numero,

          studentName:
            currentStudentName,

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
      // Compatibilité avec les anciens certificats.
      recomputedHash =
        computeLegacyCertificateHash({
          numero:
            certificate.numero,

          studentName:
            currentStudentName,

          courseTitle:
            certificate.courseTitleSnapshot,

          durationHours:
            certificate.durationHoursSnapshot,

          completionDate:
            certificate.completionDate,
        });
    }

    const integrityOk =
      recomputedHash ===
      currentHash;

    // -------------------------------------------------------------------------
    // SYNCHRONISATION
    // -------------------------------------------------------------------------

    if (
      certificate.studentNameSnapshot !==
        currentStudentName ||
      certificate.certificateHash !==
        recomputedHash
    ) {
      try {
        await prisma.certificate.update({
          where: {
            id:
              certificate.id,
          },

          data: {
            studentNameSnapshot:
              currentStudentName,

            certificateHash:
              recomputedHash,
          },
        });
      } catch (err) {
        console.error(
          'Impossible de synchroniser le certificat après vérification :',
          err.message
        );
      }
    }

    // -------------------------------------------------------------------------
    // REPONSE
    // -------------------------------------------------------------------------

    res.json({
      valid:
        true,

      integrityOk,

      numero:
        certificate.numero,

      /*
       * IMPORTANT :
       * Le nom retourné est maintenant celui de Student,
       * donc le nom corrigé.
       */
      studentName:
        currentStudentName,

      courseTitle:
        certificate.courseTitleSnapshot,

      durationHours:
        certificate.durationHoursSnapshot,

      trainingStartDate:
        certificate.trainingStartDate,

      trainingPeriod:
        formatTrainingPeriod(
          certificate.trainingStartDate
        ),

      completionDate:
        certificate.completionDate,

      issuedAt:
        certificate.issuedAt,

      certificateHash:
        recomputedHash,
    });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// LIST
// -----------------------------------------------------------------------------

async function list(
  req,
  res,
  next
) {
  try {
    const certificates =
      await prisma.certificate.findMany({
        orderBy: {
          issuedAt:
            'desc',
        },

        include: {
          enrollment: {
            include: {
              student: true,
            },
          },
        },
      });

    /*
     * On expose le nom actuel dans la liste également.
     */
    const result =
      certificates.map(
        (certificate) => {
          const student =
            certificate.enrollment?.student;

          const currentStudentName =
            student
              ? `${student.prenom || ''} ${student.nom || ''}`.trim()
              : certificate.studentNameSnapshot;

          return {
            ...certificate,

            studentName:
              currentStudentName,
          };
        }
      );

    res.json({
      certificates:
        result,
    });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// EXPORTS
// -----------------------------------------------------------------------------

module.exports = {
  issue,
  downloadPdf,
  verify,
  list,
};

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
  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  const year = value.getUTCFullYear();
  const month = value.getUTCMonth();
  const day = value.getUTCDate();

  const targetMonth = month + 1;

  const result = new Date(
    Date.UTC(
      year,
      targetMonth,
      1
    )
  );

  const daysInTargetMonth = new Date(
    Date.UTC(
      result.getUTCFullYear(),
      result.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();

  result.setUTCDate(
    Math.min(day, daysInTargetMonth)
  );

  return result;
}

/**
 * Période de formation affichée sur le certificat.
 *
 * IMPORTANT :
 * Utilise uniquement des caractères compatibles
 * avec les polices PDF standard.
 *
 * Exemple :
 * 03 août 2026 -> AOÛT 2026 - SEPTEMBRE 2026
 */
function formatTrainingPeriod(startDate, endDate) {
  if (!startDate) {
    return '';
  }

  // Pour les anciennes attestations, la date de fin n'existait pas :
  // on conserve l'ancien comportement (un mois après le début).
  const effectiveEndDate = endDate || addOneMonth(startDate);

  if (!effectiveEndDate) {
    return '';
  }

  const startMonth = formatMonthYear(startDate);
  const endMonth = formatMonthYear(effectiveEndDate);

  return startMonth === endMonth
    ? startMonth
    : `${startMonth} - ${endMonth}`;
}

/**
 * Format date pour le SHA-256.
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
  pxY,
  color = rgb(0.06, 0.09, 0.16)
) {
  if (!text) return;

  const width =
    font.widthOfTextAtSize(
      text,
      size
    );

  const { y } =
    toPt(0, pxY);

  page.drawText(text, {
    x: (PAGE_W - width) / 2,
    y,
    size,
    font,
    color,
  });
}

/**
 * Dessine un texte avec réduction automatique
 * de la taille si nécessaire.
 */
function drawFittedText(
  page,
  text,
  font,
  options = {}
) {
  const {
    x,
    y,
    maxWidth,
    size = 11,
    minSize = 7,
    color = rgb(0.06, 0.09, 0.16),
  } = options;

  if (!text) return;

  let currentSize = size;

  while (
    currentSize > minSize &&
    font.widthOfTextAtSize(
      text,
      currentSize
    ) > maxWidth
  ) {
    currentSize -= 0.25;
  }

  page.drawText(text, {
    x,
    y,
    size: currentSize,
    font,
    color,
  });
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
  trainingEndDate,
  completionDate,
}) {
  const payload = [
    numero,
    studentName,
    courseTitle,
    durationHours,
    formatDateForHash(trainingStartDate),
    formatDateForHash(trainingEndDate),
    formatDateForHash(completionDate),
  ].join('|');

  return crypto
    .createHash('sha256')
    .update(payload)
    .digest('hex');
}

/**
 * Hash V1 : utilisé par les attestations déjà créées avant l'ajout
 * de la date de fin de formation.
 */
function computeCertificateHashV1({
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
 * Retourne le hash existant.
 *
 * Pour les anciens certificats, on conserve leur hash historique
 * tant qu'il existe.
 */
async function ensureHash(certificate) {
  if (certificate.certificateHash) {
    return certificate.certificateHash;
  }

  let hash;

  if (certificate.trainingStartDate && certificate.trainingEndDate) {
    hash = computeCertificateHash({
      numero: certificate.numero,
      studentName: certificate.studentNameSnapshot,
      courseTitle: certificate.courseTitleSnapshot,
      durationHours: certificate.durationHoursSnapshot,
      trainingStartDate: certificate.trainingStartDate,
      trainingEndDate: certificate.trainingEndDate,
      completionDate: certificate.completionDate,
    });
  } else if (certificate.trainingStartDate) {
    hash = computeCertificateHashV1({
      numero: certificate.numero,
      studentName: certificate.studentNameSnapshot,
      courseTitle: certificate.courseTitleSnapshot,
      durationHours: certificate.durationHoursSnapshot,
      trainingStartDate: certificate.trainingStartDate,
      completionDate: certificate.completionDate,
    });
  } else {
    hash = computeLegacyCertificateHash({
      numero: certificate.numero,
      studentName: certificate.studentNameSnapshot,
      courseTitle: certificate.courseTitleSnapshot,
      durationHours: certificate.durationHoursSnapshot,
      completionDate: certificate.completionDate,
    });
  }

  try {
    await prisma.certificate.update({
      where: {
        id: certificate.id,
      },
      data: {
        certificateHash: hash,
      },
    });
  } catch (err) {
    console.error(
      'Impossible de sauvegarder le hash :',
      err.message
    );
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
  trainingEndDate,
  numero,
  hash,
}) {
  const bgBytes =
    fs.readFileSync(BG_PATH);

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

  const bgImage =
    await pdfDoc.embedPng(
      bgBytes
    );

  page.drawImage(bgImage, {
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H,
  });

  // ---------------------------------------------------------------------------
  // FONTS
  // ---------------------------------------------------------------------------

  const bold =
    await pdfDoc.embedFont(
      StandardFonts.HelveticaBold
    );

  const regular =
    await pdfDoc.embedFont(
      StandardFonts.Helvetica
    );

  const mono =
    await pdfDoc.embedFont(
      StandardFonts.Courier
    );

  const serifBold =
    await pdfDoc.embedFont(
      fs.readFileSync(
        SERIF_PATH
      )
    );

  // ---------------------------------------------------------------------------
  // NOM
  // ---------------------------------------------------------------------------

  drawCentered(
    page,
    studentName,
    serifBold,
    30,
    516,
    rgb(0, 0.42, 0.5)
  );

  // ---------------------------------------------------------------------------
  // FORMATION
  // ---------------------------------------------------------------------------

  drawCentered(
    page,
    courseTitle,
    bold,
    20,
    645
  );

  // ---------------------------------------------------------------------------
  // NUMERO
  // ---------------------------------------------------------------------------

  const {
    x: numX,
    y: numY,
  } = toPt(
    300,
    798
  );

  page.drawText(
    numero,
    {
      x: numX,
      y: numY,
      size: 13,
      font: regular,
      color: rgb(
        0.06,
        0.09,
        0.16
      ),
    }
  );

  // ---------------------------------------------------------------------------
  // DATE D'OBTENTION
  // ---------------------------------------------------------------------------

  const dateStr =
    formatDate(
      completionDate
    );

  const {
    x: dateX,
    y: dateY,
  } = toPt(
    625,
    798
  );

  page.drawText(
    dateStr,
    {
      x: dateX,
      y: dateY,
      size: 11,
      font: regular,
      color: rgb(
        0.06,
        0.09,
        0.16
      ),
    }
  );

  // ---------------------------------------------------------------------------
  // DUREE
  // ---------------------------------------------------------------------------

  const {
    x: dureeX,
    y: dureeY,
  } = toPt(
    1055,
    798
  );

  page.drawText(
    `${durationHours} heures`,
    {
      x: dureeX,
      y: dureeY,
      size: 12,
      font: regular,
      color: rgb(
        0.06,
        0.09,
        0.16
      ),
    }
  );

  // ---------------------------------------------------------------------------
  // PERIODE DE FORMATION
  // ---------------------------------------------------------------------------

  const periodeStr =
    formatTrainingPeriod(
      trainingStartDate,
      trainingEndDate
    );

  const {
    x: periodeX,
    y: periodeY,
  } = toPt(
    1352,
    798
  );

  const periodeMaxWidth =
    (1585 - 1352) * SCALE;

  drawFittedText(
    page,
    periodeStr,
    regular,
    {
      x: periodeX,
      y: periodeY,
      maxWidth: periodeMaxWidth,
      size: 10,
      minSize: 6.5,
      color: rgb(
        0.06,
        0.09,
        0.16
      ),
    }
  );

  // ---------------------------------------------------------------------------
  // SIGNATURE
  // ---------------------------------------------------------------------------

  const sigNameWidth =
    bold.widthOfTextAtSize(
      SIGNATORY_NAME,
      15
    );

  const {
    x: sigX,
    y: sigNameY,
  } = toPt(
    205 +
      (264 -
        sigNameWidth) / 2,
    958
  );

  page.drawText(
    SIGNATORY_NAME,
    {
      x: sigX,
      y: sigNameY,
      size: 15,
      font: bold,
      color: rgb(
        0.06,
        0.09,
        0.16
      ),
    }
  );

  const sigTitleWidth =
    regular.widthOfTextAtSize(
      SIGNATORY_TITLE,
      11
    );

  const {
    x: titleX,
    y: titleY,
  } = toPt(
    205 +
      (264 -
        sigTitleWidth) / 2,
    1004
  );

  page.drawText(
    SIGNATORY_TITLE,
    {
      x: titleX,
      y: titleY,
      size: 11,
      font: regular,
      color: rgb(
        0.4,
        0.46,
        0.55
      ),
    }
  );

  // ---------------------------------------------------------------------------
  // QR CODE
  // ---------------------------------------------------------------------------

  const frontendUrl =
    process.env.FRONTEND_URL ||
    '';

  const verifyUrl =
    `${frontendUrl}/verifier/${numero}`;

  const qrDataUrl =
    await QRCode.toDataURL(
      verifyUrl,
      {
        margin: 1,
        width: 240,
        color: {
          dark: '#0F172A',
          light: '#FFFFFF',
        },
      }
    );

  const qrBase64 =
    qrDataUrl.split(',')[1];

  const qrImage =
    await pdfDoc.embedPng(
      Buffer.from(
        qrBase64,
        'base64'
      )
    );

  const qrSizePx = 135;
  const qrLeftPx = 1465;
  const qrTopPx = 862;

  page.drawImage(
    qrImage,
    {
      x:
        qrLeftPx *
        SCALE,

      y:
        PAGE_H -
        (qrTopPx +
          qrSizePx) *
          SCALE,

      width:
        qrSizePx *
        SCALE,

      height:
        qrSizePx *
        SCALE,
    }
  );

  // ---------------------------------------------------------------------------
  // SHA-256
  // ---------------------------------------------------------------------------

  const shortHash =
    `SHA-256 : ${hash.slice(
      0,
      16
    )}...${hash.slice(-8)}`;

  const hashWidth =
    mono.widthOfTextAtSize(
      shortHash,
      6.5
    );

  const {
    x: hashX,
    y: hashY,
  } = toPt(
    qrLeftPx +
      qrSizePx / 2 -
      hashWidth /
        (2 * SCALE),
    1020
  );

  page.drawText(
    shortHash,
    {
      x: hashX,
      y: hashY,
      size: 6.5,
      font: mono,
      color: rgb(
        0.55,
        0.6,
        0.68
      ),
    }
  );

  return pdfDoc.save();
}

// -----------------------------------------------------------------------------
// ISSUE CERTIFICATE
// -----------------------------------------------------------------------------

async function issue(
  req,
  res,
  next
) {
  try {
    const {
      enrollmentId,
      trainingStartDate: trainingStartDateRaw,
      trainingEndDate: trainingEndDateRaw,
      durationHours: durationHoursRaw,
      completionDate: completionDateRaw,
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

    const archivedExistingCertificate =
      enrollment.certificate?.archivedAt
        ? enrollment.certificate
        : null;

    if (enrollment.certificate && !archivedExistingCertificate) {
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
    // PARAMÈTRES MANUELS DE L'ATTESTATION
    // -------------------------------------------------------------------------

    // Ces trois valeurs sont volontairement indépendantes de la formation
    // et de la session : elles décrivent exactement ce qui doit apparaître
    // sur l'attestation délivrée à cet apprenant.
    const trainingStartDate =
      trainingStartDateRaw
        ? new Date(trainingStartDateRaw)
        : null;

    const trainingEndDate =
      trainingEndDateRaw
        ? new Date(trainingEndDateRaw)
        : null;

    const durationHours =
      Number(durationHoursRaw);

    const finalDate =
      completionDateRaw
        ? new Date(completionDateRaw)
        : null;

    if (!trainingStartDate || Number.isNaN(trainingStartDate.getTime())) {
      return res.status(400).json({
        error: 'La date de début de la période de formation est requise et doit être valide.',
      });
    }

    if (!trainingEndDate || Number.isNaN(trainingEndDate.getTime())) {
      return res.status(400).json({
        error: 'La date de fin de la période de formation est requise et doit être valide.',
      });
    }

    if (trainingEndDate < trainingStartDate) {
      return res.status(400).json({
        error: 'La date de fin de la formation ne peut pas être antérieure à la date de début.',
      });
    }

    if (!Number.isInteger(durationHours) || durationHours <= 0) {
      return res.status(400).json({
        error: "Le nombre d'heures de formation est requis et doit être supérieur à 0.",
      });
    }

    if (!finalDate || Number.isNaN(finalDate.getTime())) {
      return res.status(400).json({
        error: "La date d'obtention est requise et doit être valide.",
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
        durationHours,
        trainingStartDate,
        trainingEndDate,
        completionDate:
          finalDate,
      });

    // -------------------------------------------------------------------------
    // CREATION CERTIFICAT
    // -------------------------------------------------------------------------

    // Si l'ancienne attestation a été archivée pour erreur, on réutilise
    // l'enregistrement afin de conserver l'historique d'audit sans créer
    // plusieurs certificats pour la même inscription. Le nouveau numéro
    // devient alors le seul numéro actif pour cette inscription.
    const certificate = archivedExistingCertificate
      ? await prisma.certificate.update({
          where: { id: archivedExistingCertificate.id },
          data: {
            numero,
            studentNameSnapshot: studentName,
            courseTitleSnapshot: enrollment.course.title,
            durationHoursSnapshot: durationHours,
            trainingStartDate,
            trainingEndDate,
            completionDate: finalDate,
            certificateHash: hash,
            issuedAt: new Date(),
            archivedAt: null,
            archivedBy: null,
            archiveReason: null,
          },
        })
      : await prisma.certificate.create({
          data: {
            enrollmentId,
            numero,
            studentNameSnapshot: studentName,
            courseTitleSnapshot: enrollment.course.title,
            durationHoursSnapshot: durationHours,
            trainingStartDate,
            trainingEndDate,
            completionDate: finalDate,
            certificateHash: hash,
          },
        });

    // -------------------------------------------------------------------------
    // MARQUER L'INSCRIPTION COMME TERMINEE
    // -------------------------------------------------------------------------

    await prisma.enrollment.update({
      where: {
        id: enrollmentId,
      },
      data: {
        statut: 'COMPLETED',
      },
    });

    await logAction(
      req.user?.id,
      archivedExistingCertificate
        ? 'CERTIFICATE_REISSUED_AFTER_ARCHIVE'
        : 'CERTIFICATE_ISSUED',
      {
        certificateId: certificate.id,
        certificateNumber: certificate.numero,
        previousCertificateNumber:
          archivedExistingCertificate?.numero || null,
        enrollmentId,
        trainingStartDate,
        trainingPeriod:
          formatTrainingPeriod(
            trainingStartDate,
            trainingEndDate
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

    // IMPORTANT :
    // On récupère l'apprenant actuel via Enrollment -> Student.
    //
    // Cela permet aux anciennes attestations de prendre automatiquement
    // en compte une correction de nom/prénom.

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

    if (!certificate || certificate.archivedAt) {
      return res.status(404).json({
        error:
          'Attestation introuvable ou archivée.',
      });
    }

    // -------------------------------------------------------------------------
    // NOM ACTUEL DE L'APPRENANT
    // -------------------------------------------------------------------------

    const currentStudentName =
      certificate.enrollment?.student
        ? `${certificate.enrollment.student.prenom} ${certificate.enrollment.student.nom}`.trim()
        : certificate.studentNameSnapshot;

    // -------------------------------------------------------------------------
    // RECALCUL DU HASH
    // -------------------------------------------------------------------------

    let hash;

    if (certificate.trainingStartDate && certificate.trainingEndDate) {
      hash =
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

          trainingEndDate:
            certificate.trainingEndDate,

          completionDate:
            certificate.completionDate,
        });
    } else if (certificate.trainingStartDate) {
      hash =
        computeCertificateHashV1({
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
      hash =
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

    // -------------------------------------------------------------------------
    // SYNCHRONISATION
    // -------------------------------------------------------------------------
    //
    // Si le nom/prénom de l'apprenant a été corrigé après émission,
    // le snapshot du certificat est automatiquement mis à jour.
    //
    // Le hash est également recalculé afin que l'attestation reste
    // cohérente avec les données actuelles.

    if (
      currentStudentName !==
        certificate.studentNameSnapshot ||
      hash !==
        certificate.certificateHash
    ) {
      try {
        await prisma.certificate.update({
          where: {
            id: certificate.id,
          },
          data: {
            studentNameSnapshot:
              currentStudentName,

            certificateHash:
              hash,
          },
        });
      } catch (syncErr) {
        console.error(
          'Impossible de synchroniser le nom/hash du certificat :',
          syncErr.message
        );
      }
    }

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

        trainingEndDate:
          certificate.trainingEndDate,

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

    // On récupère toujours le Student actuel afin que la vérification
    // corresponde au nom actuellement enregistré dans l'inscription.

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

    if (!certificate || certificate.archivedAt) {
      return res.status(404).json({
        valid: false,
        error:
          'Aucune attestation active ne correspond à ce numéro.',
      });
    }

    const currentStudentName =
      certificate.enrollment?.student
        ? `${certificate.enrollment.student.prenom} ${certificate.enrollment.student.nom}`.trim()
        : certificate.studentNameSnapshot;

    let recomputedHash;

    if (
      certificate.trainingStartDate &&
      certificate.trainingEndDate
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

          trainingEndDate:
            certificate.trainingEndDate,

          completionDate:
            certificate.completionDate,
        });
    } else if (certificate.trainingStartDate) {
      recomputedHash =
        computeCertificateHashV1({
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

    // -------------------------------------------------------------------------
    // SYNCHRONISATION DU CERTIFICAT
    // -------------------------------------------------------------------------

    if (
      currentStudentName !==
        certificate.studentNameSnapshot ||
      recomputedHash !==
        certificate.certificateHash
    ) {
      try {
        await prisma.certificate.update({
          where: {
            id: certificate.id,
          },
          data: {
            studentNameSnapshot:
              currentStudentName,

            certificateHash:
              recomputedHash,
          },
        });
      } catch (syncErr) {
        console.error(
          'Impossible de synchroniser le certificat lors de la vérification :',
          syncErr.message
        );
      }
    }

    const integrityOk =
      recomputedHash ===
        certificate.certificateHash ||
      currentStudentName !==
        certificate.studentNameSnapshot;

    res.json({
      valid: true,

      integrityOk,

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

      trainingEndDate:
        certificate.trainingEndDate,

      trainingPeriod:
        formatTrainingPeriod(
          certificate.trainingStartDate,
          certificate.trainingEndDate
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
// ARCHIVE CERTIFICATE
// -----------------------------------------------------------------------------

async function archive(
  req,
  res,
  next
) {
  try {
    const { numero } = req.params;
    const reason =
      typeof req.body?.reason === 'string'
        ? req.body.reason.trim().slice(0, 1000)
        : '';

    if (!reason) {
      return res.status(400).json({
        error: "Le motif d'archivage est requis.",
      });
    }

    const certificate = await prisma.certificate.findUnique({
      where: { numero },
    });

    if (!certificate) {
      return res.status(404).json({
        error: 'Attestation introuvable.',
      });
    }

    if (certificate.archivedAt) {
      return res.status(409).json({
        error: 'Cette attestation est déjà archivée.',
      });
    }

    const archived = await prisma.certificate.update({
      where: { id: certificate.id },
      data: {
        archivedAt: new Date(),
        archivedBy: req.user?.id || null,
        archiveReason: reason,
      },
    });

    await logAction(
      req.user?.id,
      'CERTIFICATE_ARCHIVED',
      {
        certificateId: certificate.id,
        certificateNumber: certificate.numero,
        enrollmentId: certificate.enrollmentId,
        reason,
      }
    );

    res.json({ certificate: archived });
  } catch (err) {
    next(err);
  }
}

// -----------------------------------------------------------------------------
// PERMANENT DELETE
// -----------------------------------------------------------------------------

async function remove(
  req,
  res,
  next
) {
  try {
    const { numero } = req.params;

    const certificate = await prisma.certificate.findUnique({
      where: { numero },
    });

    if (!certificate) {
      return res.status(404).json({
        error: 'Attestation introuvable.',
      });
    }

    if (!certificate.archivedAt) {
      return res.status(409).json({
        error: "Pour éviter une suppression accidentelle, l'attestation doit d'abord être archivée.",
      });
    }

    await logAction(
      req.user?.id,
      'CERTIFICATE_DELETED',
      {
        certificateId: certificate.id,
        certificateNumber: certificate.numero,
        enrollmentId: certificate.enrollmentId,
        archiveReason: certificate.archiveReason,
      }
    );

    await prisma.certificate.delete({
      where: { id: certificate.id },
    });

    res.json({
      success: true,
      message: 'Attestation supprimée définitivement.',
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
    const includeArchived =
      req.query.includeArchived === 'true' &&
      req.user?.role === 'SUPER_ADMIN';

    const certificates =
      await prisma.certificate.findMany({
        where: includeArchived ? undefined : { archivedAt: null },
        orderBy: {
          issuedAt: 'desc',
        },
      });

    res.json({
      certificates,
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
  archive,
  remove,
};

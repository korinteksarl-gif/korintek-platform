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
 * Exemple :
 * 03 août 2026 -> AOÛT 2026 — SEPTEMBRE 2026
 */
function formatTrainingPeriod(startDate) {
  if (!startDate) {
    return '';
  }

  const endDate = addOneMonth(startDate);

  if (!endDate) {
    return '';
  }

  const startMonth = formatMonthYear(startDate);
  const endMonth = formatMonthYear(endDate);

  return `${startMonth} — ${endMonth}`;
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
 * Pour les anciens certificats, on conserve leur hash historique.
 */
async function ensureHash(certificate) {
  if (certificate.certificateHash) {
    return certificate.certificateHash;
  }

  let hash;

  if (certificate.trainingStartDate) {
    hash = computeCertificateHash({
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
      trainingStartDate
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
    )}…${hash.slice(-8)}`;

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
    // Cela permet notamment de délivrer les attestations des anciennes
    // inscriptions qui ont été créées avant l'association à une session.
    // -------------------------------------------------------------------------

    let trainingSession =
      enrollment.session;

    if (!trainingSession) {
      trainingSession =
        await prisma.session.findFirst({
          where: {
            courseId:
              enrollment.courseId,
            active: true,
          },
          orderBy: {
            startDate: 'asc',
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
        id: enrollmentId,
      },
      data: {
        statut: 'COMPLETED',
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

    const certificate =
      await prisma.certificate.findUnique({
        where: {
          numero,
        },
      });

    if (!certificate) {
      return res.status(404).json({
        error:
          'Attestation introuvable.',
      });
    }

    const hash =
      await ensureHash(
        certificate
      );

    const pdfBytes =
      await generateCertificatePdf({
        studentName:
          certificate.studentNameSnapshot,

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

    const certificate =
      await prisma.certificate.findUnique({
        where: {
          numero,
        },
      });

    if (!certificate) {
      return res.status(404).json({
        valid: false,
        error:
          'Aucune attestation ne correspond à ce numéro.',
      });
    }

    const currentHash =
      await ensureHash(
        certificate
      );

    let recomputedHash;

    if (
      certificate.trainingStartDate
    ) {
      recomputedHash =
        computeCertificateHash({
          numero:
            certificate.numero,

          studentName:
            certificate.studentNameSnapshot,

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
            certificate.studentNameSnapshot,

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

    res.json({
      valid: true,

      integrityOk,

      numero:
        certificate.numero,

      studentName:
        certificate.studentNameSnapshot,

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
        currentHash,
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
};

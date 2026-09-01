const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const prisma = require('../config/db');
const { generateCertificateNumber } = require('../utils/certificateNumber');
const { logAction } = require('../utils/audit');

const BG_PATH = path.join(__dirname, '../assets/certificate_background.png');
const SERIF_PATH = path.join(__dirname, '../assets/cormorant-bold.ttf');

const SCALE = 72 / 150;
const PAGE_W = 1754 * SCALE;
const PAGE_H = 1240 * SCALE;

const SIGNATORY_NAME = 'Kodjo Tsogbe';
const SIGNATORY_TITLE = 'Directeur de la Formation';

// -----------------------------------------------------------------------------
// Helpers PDF
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
  const width = font.widthOfTextAtSize(text, size);
  const { y } = toPt(0, pxY);

  page.drawText(text, {
    x: (PAGE_W - width) / 2,
    y,
    size,
    font,
    color,
  });
}

/**
 * Formate une date PostgreSQL @db.Date sans dépendre du timezone
 * du serveur Render.
 *
 * Exemple :
 * 2026-08-25 -> 25 août 2026
 */
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
 * Construit la période affichée sur l'attestation.
 *
 * Même jour :
 *   31 août 2026
 *
 * Plusieurs jours :
 *   25 août 2026 — 31 août 2026
 */
function formatTrainingPeriod(startDate, endDate) {
  const start = formatDate(startDate);

  if (!start) return '';

  const end = formatDate(endDate);

  if (!end) return start;

  const startValue = new Date(startDate);
  const endValue = new Date(endDate);

  const sameDay =
    startValue.getUTCFullYear() === endValue.getUTCFullYear() &&
    startValue.getUTCMonth() === endValue.getUTCMonth() &&
    startValue.getUTCDate() === endValue.getUTCDate();

  if (sameDay) {
    return start;
  }

  return `${start} — ${end}`;
}

/**
 * Dessine un texte en réduisant automatiquement sa taille
 * lorsqu'il dépasse la largeur disponible.
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
    font.widthOfTextAtSize(text, currentSize) > maxWidth
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

/**
 * Hash actuel des nouveaux certificats.
 *
 * La période de formation est maintenant protégée par le hash.
 */
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
 * Ancienne méthode de hash utilisée avant l'ajout de la période.
 *
 * Elle est conservée pour que les anciennes attestations restent
 * vérifiables après la migration.
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

function formatDateForHash(date) {
  if (!date) return '';

  const value = new Date(date);

  if (Number.isNaN(value.getTime())) {
    return '';
  }

  return value.toISOString().slice(0, 10);
}

/**
 * Garantit qu'un certificat possède un hash.
 *
 * - Nouveau certificat avec période :
 *   hash nouvelle version.
 *
 * - Ancien certificat sans période :
 *   hash historique.
 *
 * Cela évite de casser les attestations déjà délivrées.
 */
async function ensureHash(certificate) {
  if (certificate.certificateHash) {
    return certificate.certificateHash;
  }

  let hash;

  if (
    certificate.trainingStartDate ||
    certificate.trainingEndDate
  ) {
    hash = computeCertificateHash({
      numero: certificate.numero,
      studentName: certificate.studentNameSnapshot,
      courseTitle: certificate.courseTitleSnapshot,
      durationHours: certificate.durationHoursSnapshot,
      trainingStartDate: certificate.trainingStartDate,
      trainingEndDate: certificate.trainingEndDate,
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
      where: { id: certificate.id },
      data: { certificateHash: hash },
    });
  } catch (err) {
    console.error(
      'Impossible de sauvegarder le hash rétroactif:',
      err.message
    );
  }

  return hash;
}

// -----------------------------------------------------------------------------
// Génération PDF
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
  const bgBytes = fs.readFileSync(BG_PATH);

  const pdfDoc = await PDFDocument.create();

  pdfDoc.registerFontkit(fontkit);

  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  // ---------------------------------------------------------------------------
  // Background
  // ---------------------------------------------------------------------------

  const bgImage = await pdfDoc.embedPng(bgBytes);

  page.drawImage(bgImage, {
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H,
  });

  // ---------------------------------------------------------------------------
  // Fonts
  // ---------------------------------------------------------------------------

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);

  const serifBold = await pdfDoc.embedFont(
    fs.readFileSync(SERIF_PATH)
  );

  // ---------------------------------------------------------------------------
  // Nom du candidat
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
  // Formation
  // ---------------------------------------------------------------------------

  drawCentered(
    page,
    courseTitle,
    bold,
    20,
    645
  );

  // ---------------------------------------------------------------------------
  // N° de certificat
  // ---------------------------------------------------------------------------

  const {
    x: numX,
    y: numY,
  } = toPt(300, 798);

  page.drawText(numero, {
    x: numX,
    y: numY,
    size: 13,
    font: regular,
    color: rgb(0.06, 0.09, 0.16),
  });

  // ---------------------------------------------------------------------------
  // Date d'obtention
  // ---------------------------------------------------------------------------

  const dateStr = formatDate(completionDate);

  const {
    x: dateX,
    y: dateY,
  } = toPt(625, 798);

  page.drawText(dateStr, {
    x: dateX,
    y: dateY,
    size: 11,
    font: regular,
    color: rgb(0.06, 0.09, 0.16),
  });

  // ---------------------------------------------------------------------------
  // Durée
  // ---------------------------------------------------------------------------

  const {
    x: dureeX,
    y: dureeY,
  } = toPt(1055, 798);

  page.drawText(`${durationHours} heures`, {
    x: dureeX,
    y: dureeY,
    size: 12,
    font: regular,
    color: rgb(0.06, 0.09, 0.16),
  });

  // ---------------------------------------------------------------------------
  // Période de formation
  // ---------------------------------------------------------------------------

  const periodeStr = formatTrainingPeriod(
    trainingStartDate,
    trainingEndDate
  );

  const {
    x: periodeX,
    y: periodeY,
  } = toPt(1352, 798);

  // Largeur disponible approximative de la colonne
  // entre x=1342 et x=1585 du gabarit.
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
      size: 11,
      minSize: 7.5,
      color: rgb(0.06, 0.09, 0.16),
    }
  );

  // ---------------------------------------------------------------------------
  // Signature
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
    205 + (264 - sigNameWidth) / 2,
    958
  );

  page.drawText(SIGNATORY_NAME, {
    x: sigX,
    y: sigNameY,
    size: 15,
    font: bold,
    color: rgb(0.06, 0.09, 0.16),
  });

  const sigTitleWidth =
    regular.widthOfTextAtSize(
      SIGNATORY_TITLE,
      11
    );

  const {
    x: titleX,
    y: titleY,
  } = toPt(
    205 + (264 - sigTitleWidth) / 2,
    1004
  );

  page.drawText(SIGNATORY_TITLE, {
    x: titleX,
    y: titleY,
    size: 11,
    font: regular,
    color: rgb(0.4, 0.46, 0.55),
  });

  // ---------------------------------------------------------------------------
  // QR Code
  // ---------------------------------------------------------------------------

  const verifyUrl =
    `${process.env.FRONTEND_URL}/verifier/${numero}`;

  const qrDataUrl = await QRCode.toDataURL(
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

  const qrImage = await pdfDoc.embedPng(
    Buffer.from(qrBase64, 'base64')
  );

  const qrSizePx = 135;
  const qrLeftPx = 1465;
  const qrTopPx = 862;

  page.drawImage(qrImage, {
    x: qrLeftPx * SCALE,
    y: PAGE_H - (qrTopPx + qrSizePx) * SCALE,
    width: qrSizePx * SCALE,
    height: qrSizePx * SCALE,
  });

  // ---------------------------------------------------------------------------
  // Empreinte SHA-256
  // ---------------------------------------------------------------------------

  const shortHash =
    `SHA-256 : ${hash.slice(0, 16)}…${hash.slice(-8)}`;

  const hashWidth =
    mono.widthOfTextAtSize(shortHash, 6.5);

  const {
    x: hashX,
    y: hashY,
  } = toPt(
    qrLeftPx +
      qrSizePx / 2 -
      hashWidth / (2 * SCALE),
    1020
  );

  page.drawText(shortHash, {
    x: hashX,
    y: hashY,
    size: 6.5,
    font: mono,
    color: rgb(0.55, 0.6, 0.68),
  });

  return pdfDoc.save();
}

// -----------------------------------------------------------------------------
// POST /api/v1/certificates/issue
// Délivre l'attestation d'une inscription terminée.
// -----------------------------------------------------------------------------

async function issue(req, res, next) {
  try {
    const {
      enrollmentId,
      completionDate,
    } = req.body;

    if (!enrollmentId) {
      return res.status(400).json({
        error: "L'identifiant de l'inscription est requis.",
      });
    }

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
        error: 'Inscription introuvable.',
      });
    }

    if (enrollment.certificate) {
      return res.status(409).json({
        error:
          'Une attestation existe déjà pour cette inscription.',
      });
    }

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
    // Vérification de la session
    // -------------------------------------------------------------------------

    if (!enrollment.session) {
      return res.status(400).json({
        error:
          "Impossible de délivrer l'attestation : aucune session de formation n'est associée à cette inscription.",
      });
    }

    if (!enrollment.session.startDate) {
      return res.status(400).json({
        error:
          "Impossible de délivrer l'attestation : la date de début de formation n'est pas renseignée.",
      });
    }

    if (!enrollment.session.endDate) {
      return res.status(400).json({
        error:
          "Impossible de délivrer l'attestation : la date de fin de formation n'est pas renseignée.",
      });
    }

    // -------------------------------------------------------------------------
    // Date d'obtention
    // -------------------------------------------------------------------------

    const finalDate = completionDate
      ? new Date(completionDate)
      : new Date();

    if (Number.isNaN(finalDate.getTime())) {
      return res.status(400).json({
        error:
          "La date d'obtention fournie est invalide.",
      });
    }

    // -------------------------------------------------------------------------
    // Données de l'étudiant
    // -------------------------------------------------------------------------

    const numero =
      await generateCertificateNumber();

    const studentName =
      `${enrollment.student.prenom} ${enrollment.student.nom}`;

    const trainingStartDate =
      enrollment.session.startDate;

    const trainingEndDate =
      enrollment.session.endDate;

    // -------------------------------------------------------------------------
    // SHA-256
    // -------------------------------------------------------------------------

    const hash =
      computeCertificateHash({
        numero,
        studentName,
        courseTitle: enrollment.course.title,
        durationHours:
          enrollment.course.durationHours,
        trainingStartDate,
        trainingEndDate,
        completionDate: finalDate,
      });

    // -------------------------------------------------------------------------
    // Création du certificat
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
          trainingEndDate,

          completionDate: finalDate,

          certificateHash: hash,
        },
      });

    // -------------------------------------------------------------------------
    // Marquer l'inscription comme terminée
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
        certificateId: certificate.id,
        certificateNumber: certificate.numero,
        enrollmentId,
        trainingStartDate,
        trainingEndDate,
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
// GET /api/v1/certificates/:numero/pdf
// Génère et renvoie le PDF.
// -----------------------------------------------------------------------------

async function downloadPdf(req, res, next) {
  try {
    const { numero } = req.params;

    const certificate =
      await prisma.certificate.findUnique({
        where: {
          numero,
        },
      });

    if (!certificate) {
      return res.status(404).json({
        error: 'Attestation introuvable.',
      });
    }

    const hash =
      await ensureHash(certificate);

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
// GET /api/v1/certificates/verify/:numero
// PUBLIC — vérification d'authenticité
// -----------------------------------------------------------------------------

async function verify(req, res, next) {
  try {
    const { numero } = req.params;

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
      await ensureHash(certificate);

    // -------------------------------------------------------------------------
    // Pour les anciens certificats sans période,
    // on conserve la méthode historique.
    // Pour les nouveaux, on utilise le hash incluant la période.
    // -------------------------------------------------------------------------

    let recomputedHash;

    if (
      certificate.trainingStartDate ||
      certificate.trainingEndDate
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

          trainingEndDate:
            certificate.trainingEndDate,

          completionDate:
            certificate.completionDate,
        });
    } else {
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
      recomputedHash === currentHash;

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

      // Nouvelles informations
      trainingStartDate:
        certificate.trainingStartDate,

      trainingEndDate:
        certificate.trainingEndDate,

      trainingPeriod:
        formatTrainingPeriod(
          certificate.trainingStartDate,
          certificate.trainingEndDate
        ),

      // Date d'obtention
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
// GET /api/v1/certificates
// Liste staff
// -----------------------------------------------------------------------------

async function list(req, res, next) {
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
// Exports
// -----------------------------------------------------------------------------

module.exports = {
  issue,
  downloadPdf,
  verify,
  list,
};

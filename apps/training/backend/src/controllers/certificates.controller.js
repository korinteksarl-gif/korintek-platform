const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const prisma = require('../config/db');
const { generateCertificateNumber } = require('../utils/certificateNumber');
const { logAction } = require('../utils/audit');

const BG_PATH = path.join(__dirname, '../assets/certificate_background.jpg');
const SERIF_PATH = path.join(__dirname, '../assets/cormorant-bold.ttf');
const SCALE = 72 / 150;
const PAGE_W = 1754 * SCALE;
const PAGE_H = 1240 * SCALE;

const SIGNATORY_NAME = 'Kodjo Tsogbe';
const SIGNATORY_TITLE = 'Directeur de la Formation';

function toPt(pxX, pxY) {
  return { x: pxX * SCALE, y: PAGE_H - pxY * SCALE };
}

function drawCentered(page, text, font, size, pxY, color = rgb(0.06, 0.09, 0.16)) {
  const width = font.widthOfTextAtSize(text, size);
  const { y } = toPt(0, pxY);
  page.drawText(text, { x: (PAGE_W - width) / 2, y, size, font, color });
}

function computeCertificateHash({ numero, studentName, courseTitle, durationHours, completionDate }) {
  const payload = `${numero}|${studentName}|${courseTitle}|${durationHours}|${new Date(completionDate).toISOString().slice(0, 10)}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

// Certains certificats (ex: le tout premier, créé avant l'ajout de ce champ)
// peuvent ne pas encore avoir d'empreinte en base. On la calcule alors à la
// volée et on la sauvegarde, plutôt que de planter — auto-réparation silencieuse.
async function ensureHash(certificate) {
  if (certificate.certificateHash) return certificate.certificateHash;

  const hash = computeCertificateHash({
    numero: certificate.numero,
    studentName: certificate.studentNameSnapshot,
    courseTitle: certificate.courseTitleSnapshot,
    durationHours: certificate.durationHoursSnapshot,
    completionDate: certificate.completionDate,
  });

  try {
    await prisma.certificate.update({ where: { id: certificate.id }, data: { certificateHash: hash } });
  } catch (err) {
    console.error('Impossible de sauvegarder le hash rétroactif:', err.message);
  }

  return hash;
}

async function generateCertificatePdf({ studentName, courseTitle, durationHours, completionDate, numero, hash }) {
  const bgBytes = fs.readFileSync(BG_PATH);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  const bgImage = await pdfDoc.embedJpg(bgBytes);
  page.drawImage(bgImage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);
  const serifBold = await pdfDoc.embedFont(fs.readFileSync(SERIF_PATH));

  drawCentered(page, studentName, serifBold, 36, 465, rgb(0, 0.42, 0.5));
  drawCentered(page, 'a suivi avec succès la formation', regular, 15, 545);
  drawCentered(page, courseTitle, bold, 20, 592);
  drawCentered(page, `d'une durée de ${durationHours} heures`, italic, 14, 635);

  const sigNameWidth = bold.widthOfTextAtSize(SIGNATORY_NAME, 16);
  const { x: sigX, y: sigNameY } = toPt(220 + (300 - sigNameWidth) / 2, 1000);
  page.drawText(SIGNATORY_NAME, { x: sigX, y: sigNameY, size: 16, font: bold, color: rgb(0.06, 0.09, 0.16) });
  const sigTitleWidth = regular.widthOfTextAtSize(SIGNATORY_TITLE, 13);
  const { x: titleX, y: titleY } = toPt(220 + (300 - sigTitleWidth) / 2, 1022);
  page.drawText(SIGNATORY_TITLE, { x: titleX, y: titleY, size: 13, font: regular, color: rgb(0.4, 0.46, 0.55) });

  const dateStr = new Date(completionDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const { x: dateX, y: dateY } = toPt(1754 - 520, 965);
  page.drawText(dateStr, { x: dateX + 10, y: dateY, size: 13, font: regular, color: rgb(0.06, 0.09, 0.16) });

  const numWidth = regular.widthOfTextAtSize(`N° ${numero}`, 13);
  const { x: numX, y: numY } = toPt(1754 - 60 - numWidth / SCALE, 45);
  page.drawText(`N° ${numero}`, { x: numX, y: numY, size: 13, font: regular, color: rgb(0.87, 0.74, 0.43) });

  const verifyUrl = `${process.env.FRONTEND_URL}/verifier/${numero}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240, color: { dark: '#0F172A', light: '#FFFFFF' } });
  const qrBase64 = qrDataUrl.split(',')[1];
  const qrImage = await pdfDoc.embedPng(Buffer.from(qrBase64, 'base64'));

  const qrSizePx = 140;
  const qrLeftPx = 1754 / 2 - qrSizePx / 2;
  const qrTopPx = 700;
  const qrBottomPx = qrTopPx + qrSizePx;

  page.drawImage(qrImage, {
    x: qrLeftPx * SCALE,
    y: PAGE_H - qrBottomPx * SCALE,
    width: qrSizePx * SCALE,
    height: qrSizePx * SCALE,
  });

  drawCentered(page, 'Scanner pour vérifier', italic, 8, qrBottomPx + 18, rgb(0.4, 0.46, 0.55));

  const shortHash = `SHA-256 : ${hash.slice(0, 16)}…${hash.slice(-8)}`;
  drawCentered(page, shortHash, mono, 7, qrBottomPx + 34, rgb(0.55, 0.6, 0.68));

  return pdfDoc.save();
}

async function issue(req, res, next) {
  try {
    const { enrollmentId, completionDate } = req.body;
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: true, course: true, certificate: true },
    });

    if (!enrollment) return res.status(404).json({ error: 'Inscription introuvable.' });
    if (enrollment.certificate) return res.status(409).json({ error: 'Une attestation existe déjà pour cette inscription.' });

    const numero = await generateCertificateNumber();
    const finalDate = completionDate ? new Date(completionDate) : new Date();
    const studentName = `${enrollment.student.prenom} ${enrollment.student.nom}`;

    const hash = computeCertificateHash({
      numero,
      studentName,
      courseTitle: enrollment.course.title,
      durationHours: enrollment.course.durationHours,
      completionDate: finalDate,
    });

    const certificate = await prisma.certificate.create({
      data: {
        enrollmentId,
        numero,
        studentNameSnapshot: studentName,
        courseTitleSnapshot: enrollment.course.title,
        durationHoursSnapshot: enrollment.course.durationHours,
        completionDate: finalDate,
        certificateHash: hash,
      },
    });

    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { statut: 'COMPLETED' } });

    await logAction(req.user?.id, 'CERTIFICATE_ISSUED', { certificateId: certificate.id, numero, enrollmentId });

    res.status(201).json({ certificate });
  } catch (err) {
    next(err);
  }
}

async function downloadPdf(req, res, next) {
  try {
    const { numero } = req.params;
    const certificate = await prisma.certificate.findUnique({ where: { numero } });
    if (!certificate) return res.status(404).json({ error: 'Attestation introuvable.' });

    const hash = await ensureHash(certificate);

    const pdfBytes = await generateCertificatePdf({
      studentName: certificate.studentNameSnapshot,
      courseTitle: certificate.courseTitleSnapshot,
      durationHours: certificate.durationHoursSnapshot,
      completionDate: certificate.completionDate,
      numero: certificate.numero,
      hash,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${numero}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    next(err);
  }
}

async function verify(req, res, next) {
  try {
    const { numero } = req.params;
    const certificate = await prisma.certificate.findUnique({ where: { numero } });
    if (!certificate) {
      return res.status(404).json({ valid: false, error: 'Aucune attestation ne correspond à ce numéro.' });
    }

    const currentHash = await ensureHash(certificate);
    const recomputedHash = computeCertificateHash({
      numero: certificate.numero,
      studentName: certificate.studentNameSnapshot,
      courseTitle: certificate.courseTitleSnapshot,
      durationHours: certificate.durationHoursSnapshot,
      completionDate: certificate.completionDate,
    });
    const integrityOk = recomputedHash === currentHash;

    res.json({
      valid: true,
      integrityOk,
      numero: certificate.numero,
      studentName: certificate.studentNameSnapshot,
      courseTitle: certificate.courseTitleSnapshot,
      durationHours: certificate.durationHoursSnapshot,
      completionDate: certificate.completionDate,
      issuedAt: certificate.issuedAt,
      certificateHash: currentHash,
    });
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const certificates = await prisma.certificate.findMany({ orderBy: { issuedAt: 'desc' } });
    res.json({ certificates });
  } catch (err) {
    next(err);
  }
}

module.exports = { issue, downloadPdf, verify, list };

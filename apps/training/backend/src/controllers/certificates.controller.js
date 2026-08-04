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

// Certificats créés avant l'ajout du champ certificateHash n'en ont pas. On la
// calcule alors à la volée et on la sauvegarde, plutôt que de planter — auto-réparation silencieuse.
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

// Coordonnées calées sur le gabarit certificate_background.png (1754x1240px),
// converties en points PDF. Le gabarit contient déjà les libellés statiques
// ("a suivi avec succès la formation", "N° DE CERTIFICAT", etc.) — on ne
// dessine ICI que les valeurs dynamiques, jamais les libellés eux-mêmes,
// pour éviter tout doublon de texte.
async function generateCertificatePdf({ studentName, courseTitle, durationHours, completionDate, numero, hash }) {
  const bgBytes = fs.readFileSync(BG_PATH);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  const bgImage = await pdfDoc.embedPng(bgBytes);
  page.drawImage(bgImage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);
  const serifBold = await pdfDoc.embedFont(fs.readFileSync(SERIF_PATH));

  // --- Nom du candidat (sur la 1ère ligne vide, px y=500 -> juste au-dessus) ---
  drawCentered(page, studentName, serifBold, 32, 480, rgb(0, 0.42, 0.5));

  // --- Formation (sur la 2ème ligne vide, px y=635 -> juste au-dessus) ---
  drawCentered(page, courseTitle, bold, 22, 615);

  // --- N° de certificat (à côté du libellé "N°", px x=300/y=765) ---
  const { x: numX, y: numY } = toPt(320, 774);
  page.drawText(numero, { x: numX, y: numY, size: 16, font: regular, color: rgb(0.06, 0.09, 0.16) });

  // --- Date d'obtention (px x=615/y=778, sur la ligne) ---
  const dateStr = new Date(completionDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const { x: dateX, y: dateY } = toPt(625, 774);
  page.drawText(dateStr, { x: dateX, y: dateY, size: 14, font: regular, color: rgb(0.06, 0.09, 0.16) });

  // --- Durée (à côté de "Durée :", px x=960/y=765) ---
  const { x: dureeX, y: dureeY } = toPt(1045, 774);
  page.drawText(`${durationHours} heures`, { x: dureeX, y: dureeY, size: 16, font: regular, color: rgb(0.06, 0.09, 0.16) });

  // --- Période de formation (px x=1365/y=778, sur la ligne) ---
  const { x: periodeX, y: periodeY } = toPt(1375, 774);
  page.drawText(dateStr, { x: periodeX, y: periodeY, size: 13, font: regular, color: rgb(0.06, 0.09, 0.16) });

  // --- Signature (nom + titre, sur la ligne signature px x=220-580/y=905) ---
  const sigNameWidth = bold.widthOfTextAtSize(SIGNATORY_NAME, 16);
  const { x: sigX, y: sigNameY } = toPt(220 + (360 - sigNameWidth) / 2, 895);
  page.drawText(SIGNATORY_NAME, { x: sigX, y: sigNameY, size: 16, font: bold, color: rgb(0.06, 0.09, 0.16) });

  const sigTitleWidth = regular.widthOfTextAtSize(SIGNATORY_TITLE, 12);
  const { x: titleX, y: titleY } = toPt(220 + (360 - sigTitleWidth) / 2, 928);
  page.drawText(SIGNATORY_TITLE, { x: titleX, y: titleY, size: 12, font: regular, color: rgb(0.4, 0.46, 0.55) });

  // --- QR code (dans le cadre vide prévu à droite, px x=1500-1650/y=820-970) ---
  const verifyUrl = `${process.env.FRONTEND_URL}/verifier/${numero}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240, color: { dark: '#0F172A', light: '#FFFFFF' } });
  const qrBase64 = qrDataUrl.split(',')[1];
  const qrImage = await pdfDoc.embedPng(Buffer.from(qrBase64, 'base64'));

  const qrSizePx = 150;
  const qrLeftPx = 1500;
  const qrTopPx = 820;

  page.drawImage(qrImage, {
    x: qrLeftPx * SCALE,
    y: PAGE_H - (qrTopPx + qrSizePx) * SCALE,
    width: qrSizePx * SCALE,
    height: qrSizePx * SCALE,
  });

  // --- Empreinte SHA-256 (sous le QR, tronquée pour la lisibilité) ---
  const shortHash = `SHA-256 : ${hash.slice(0, 16)}…${hash.slice(-8)}`;
  const hashWidth = mono.widthOfTextAtSize(shortHash, 7);
  const { x: hashX, y: hashY } = toPt(qrLeftPx + qrSizePx / 2 - hashWidth / (2 * SCALE), qrTopPx + qrSizePx + 55);
  page.drawText(shortHash, { x: hashX, y: hashY, size: 7, font: mono, color: rgb(0.55, 0.6, 0.68) });

  return pdfDoc.save();
}

// POST /api/v1/certificates/issue — délivre l'attestation d'une inscription "Terminée"
async function issue(req, res, next) {
  try {
    const { enrollmentId, completionDate } = req.body;
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { student: true, course: true, certificate: true },
    });

    if (!enrollment) return res.status(404).json({ error: 'Inscription introuvable.' });
    if (enrollment.certificate) return res.status(409).json({ error: 'Une attestation existe déjà pour cette inscription.' });

    // Blocage si le paiement n'est pas complet — protection backend, indépendante
    // de l'état grisé du bouton côté frontend.
    if (enrollment.amountPaid < enrollment.amountDue) {
      return res.status(402).json({ error: "Le paiement n'est pas complet. Impossible de délivrer l'attestation." });
    }

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

    res.status(201).json({ certificate });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/certificates/:numero/pdf — génère et renvoie le PDF
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

// GET /api/v1/certificates/verify/:numero — PUBLIC, vérification d'authenticité
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

// GET /api/v1/certificates — liste staff
async function list(req, res, next) {
  try {
    const certificates = await prisma.certificate.findMany({ orderBy: { issuedAt: 'desc' } });
    res.json({ certificates });
  } catch (err) {
    next(err);
  }
}

module.exports = { issue, downloadPdf, verify, list };

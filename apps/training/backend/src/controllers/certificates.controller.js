const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const prisma = require('../config/db');
const { generateCertificateNumber } = require('../utils/certificateNumber');

const BG_PATH = path.join(__dirname, '../assets/certificate_background.png');
// Le fond a été dessiné à 150dpi (1754x1240 px) ; conversion px -> points PDF (72dpi).
const SCALE = 72 / 150;
const PAGE_W = 1754 * SCALE;
const PAGE_H = 1240 * SCALE;

function toPt(pxX, pxY) {
  return { x: pxX * SCALE, y: PAGE_H - pxY * SCALE };
}

function drawCentered(page, text, font, size, pxY, color = rgb(0.06, 0.09, 0.16)) {
  const width = font.widthOfTextAtSize(text, size);
  const { y } = toPt(0, pxY);
  page.drawText(text, { x: (PAGE_W - width) / 2, y, size, font, color });
}

async function generateCertificatePdf({ studentName, courseTitle, durationHours, completionDate, numero }) {
  const bgBytes = fs.readFileSync(BG_PATH);
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  const bgImage = await pdfDoc.embedPng(bgBytes);
  page.drawImage(bgImage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  drawCentered(page, studentName, bold, 30, 545, rgb(0, 0.42, 0.5));
  drawCentered(page, 'a suivi avec succès la formation', regular, 15, 650);
  drawCentered(page, courseTitle, bold, 20, 700);
  drawCentered(page, `d'une durée de ${durationHours} heures`, italic, 14, 745);

  const dateStr = new Date(completionDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const { x: dateX, y: dateY } = toPt(1754 - 520, 1240 - 225);
  page.drawText(dateStr, { x: dateX + 10, y: dateY, size: 13, font: regular, color: rgb(0.06, 0.09, 0.16) });

  const { x: numX, y: numY } = toPt(1754 - 430, 55);
  page.drawText(`N° ${numero}`, { x: numX, y: numY, size: 12, font: regular, color: rgb(0.4, 0.46, 0.55) });

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

    const numero = await generateCertificateNumber();
    const finalDate = completionDate ? new Date(completionDate) : new Date();
    const studentName = `${enrollment.student.prenom} ${enrollment.student.nom}`;

    const certificate = await prisma.certificate.create({
      data: {
        enrollmentId,
        numero,
        studentNameSnapshot: studentName,
        courseTitleSnapshot: enrollment.course.title,
        durationHoursSnapshot: enrollment.course.durationHours,
        completionDate: finalDate,
      },
    });

    await prisma.enrollment.update({ where: { id: enrollmentId }, data: { statut: 'COMPLETED' } });

    res.status(201).json({ certificate });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/certificates/:numero/pdf — génère et renvoie le PDF (staff ou lien direct)
async function downloadPdf(req, res, next) {
  try {
    const { numero } = req.params;
    const certificate = await prisma.certificate.findUnique({ where: { numero } });
    if (!certificate) return res.status(404).json({ error: 'Attestation introuvable.' });

    const pdfBytes = await generateCertificatePdf({
      studentName: certificate.studentNameSnapshot,
      courseTitle: certificate.courseTitleSnapshot,
      durationHours: certificate.durationHoursSnapshot,
      completionDate: certificate.completionDate,
      numero: certificate.numero,
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
    res.json({
      valid: true,
      numero: certificate.numero,
      studentName: certificate.studentNameSnapshot,
      courseTitle: certificate.courseTitleSnapshot,
      durationHours: certificate.durationHoursSnapshot,
      completionDate: certificate.completionDate,
      issuedAt: certificate.issuedAt,
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

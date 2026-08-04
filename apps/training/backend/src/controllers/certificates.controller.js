const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const fs = require('fs');
const path = require('path');

async function generateCertificatePdf({ nomCandidat, formation, numero, dateObtention, duree, periode, signatureImageBytes, qrCodeImageBytes, logoImageBytes }) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const page = pdfDoc.addPage([1754, 1240]);

  // --- Fond ---
  const bgBytes = fs.readFileSync(path.join(__dirname, '../assets/certificate_background.png'));
  const bgImage = await pdfDoc.embedPng(bgBytes);
  page.drawImage(bgImage, { x: 0, y: 0, width: 1754, height: 1240 });

  // --- Police (Cormorant Garamond déjà en place) ---
  const fontBytes = fs.readFileSync(path.join(__dirname, '../assets/cormorant-bold.ttf'));
  const titleFont = await pdfDoc.embedFont(fontBytes);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // --- Nom du candidat (centré) ---
  const nameSize = 32;
  const nameWidth = titleFont.widthOfTextAtSize(nomCandidat, nameSize);
  page.drawText(nomCandidat, {
    x: 877 - nameWidth / 2, y: 755, size: nameSize, font: titleFont, color: rgb(0.04, 0.12, 0.17),
  });

  // --- Formation (centré) ---
  const formSize = 24;
  const formWidth = bodyFont.widthOfTextAtSize(formation, formSize);
  page.drawText(formation, {
    x: 877 - formWidth / 2, y: 620, size: formSize, font: bodyFont, color: rgb(0.04, 0.12, 0.17),
  });

  // --- N° certificat / Date / Durée / Période ---
  page.drawText(numero, { x: 300, y: 475, size: 18, font: bodyFont, color: rgb(0.04, 0.12, 0.17) });
  page.drawText(dateObtention, { x: 615, y: 468, size: 16, font: bodyFont, color: rgb(0.04, 0.12, 0.17) });
  page.drawText(duree, { x: 1010, y: 475, size: 16, font: bodyFont, color: rgb(0.04, 0.12, 0.17) });
  page.drawText(periode, { x: 1365, y: 468, size: 16, font: bodyFont, color: rgb(0.04, 0.12, 0.17) });

  // --- Logo (si fourni) ---
  if (logoImageBytes) {
    const logoImage = await pdfDoc.embedPng(logoImageBytes);
    page.drawImage(logoImage, { x: 232, y: 1092, width: 100, height: 100 });
  }

  // --- Signature ---
  if (signatureImageBytes) {
    const sigImage = await pdfDoc.embedPng(signatureImageBytes);
    page.drawImage(sigImage, { x: 220, y: 355, width: 360, height: 90 });
  }

  // --- QR code ---
  if (qrCodeImageBytes) {
    const qrImage = await pdfDoc.embedPng(qrCodeImageBytes);
    page.drawImage(qrImage, { x: 1500, y: 270, width: 150, height: 150 });
  }

  return pdfDoc.save();
}

module.exports = { generateCertificatePdf };

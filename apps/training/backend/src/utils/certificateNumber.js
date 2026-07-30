const prisma = require('../config/db');

// Génère un numéro d'attestation du type KTK-2026-000123, séquentiel par année.
async function generateCertificateNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.certificate.count({
    where: { numero: { startsWith: `KTK-${year}-` } },
  });
  const next = String(count + 1).padStart(6, '0');
  return `KTK-${year}-${next}`;
}

module.exports = { generateCertificateNumber };

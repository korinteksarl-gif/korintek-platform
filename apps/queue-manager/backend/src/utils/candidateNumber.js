// Génération séquentielle du numéro de candidat du jour: A001, A002, A003...
const prisma = require('../config/db');

async function generateCandidateNumber(datePassage) {
  const start = new Date(datePassage);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const countToday = await prisma.candidate.count({
    where: { datePassage: { gte: start, lt: end } },
  });

  const nextNumber = countToday + 1;
  return `A${String(nextNumber).padStart(3, '0')}`;
}

module.exports = { generateCandidateNumber };

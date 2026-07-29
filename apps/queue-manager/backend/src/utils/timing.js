// Logique de rappel automatique (T-15min) et de calcul des retards par poste.
// Aucun cron externe requis : ces fonctions sont appelées à chaque consultation
// de la file (polling existant de /agent et /display), ce qui suffit à déclencher
// les transitions en temps quasi-réel sans complexifier le déploiement Render.
const prisma = require('../config/db');

const ADMISSION_LEAD_MINUTES = 15;

function dayRange(dateStr) {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// Calcule le nombre de minutes restantes avant l'heure de convocation d'un candidat
// (négatif si l'heure est déjà passée).
function minutesUntilStart(candidate, now = new Date()) {
  const start = new Date(candidate.datePassage);
  const [h, m] = candidate.heureConvocation.split(':').map(Number);
  start.setHours(h, m, 0, 0);
  return Math.round((start.getTime() - now.getTime()) / 60000);
}

// Fait passer en statut ADMISSION tout candidat WAITING dont l'heure de convocation
// arrive dans moins de 15 minutes. Appelée avant toute lecture de la file du jour.
async function promoteDueForAdmission(dateStr) {
  const { start, end } = dayRange(dateStr);
  const now = new Date();

  const candidates = await prisma.candidate.findMany({
    where: { datePassage: { gte: start, lt: end }, statut: 'WAITING' },
  });

  const due = candidates.filter((c) => minutesUntilStart(c, now) <= ADMISSION_LEAD_MINUTES);

  if (due.length) {
    await prisma.candidate.updateMany({
      where: { id: { in: due.map((c) => c.id) } },
      data: { statut: 'ADMISSION', admissionNotifiedAt: now },
    });
  }

  return due.length;
}

// Calcule le retard (en minutes) d'un candidat actuellement en examen (CALLED),
// par rapport à la durée estimée de son épreuve. Retourne 0 s'il n'y a pas de retard.
function computeOverrunMinutes(candidate, now = new Date()) {
  if (!candidate.startedAt) return 0;
  const expectedEnd = new Date(candidate.startedAt).getTime() + candidate.dureeMinutes * 60000;
  const overrun = Math.round((now.getTime() - expectedEnd) / 60000);
  return overrun > 0 ? overrun : 0;
}

// Pour une liste de candidats d'une même journée, calcule le retard courant par
// poste (basé sur le candidat actuellement CALLED sur ce poste) et l'attache à
// tous les candidats en attente du même poste, pour affichage côté staff.
function annotateWithDelays(candidates) {
  const now = new Date();
  const delayByPoste = {};

  candidates.forEach((c) => {
    if (c.statut === 'CALLED' && c.poste) {
      const overrun = computeOverrunMinutes(c, now);
      if (overrun > 0) delayByPoste[c.poste] = overrun;
    }
  });

  return candidates.map((c) => ({
    ...c,
    retardMinutes:
      c.statut === 'CALLED'
        ? computeOverrunMinutes(c, now)
        : c.poste && delayByPoste[c.poste]
        ? delayByPoste[c.poste]
        : 0,
  }));
}

module.exports = { promoteDueForAdmission, computeOverrunMinutes, annotateWithDelays, ADMISSION_LEAD_MINUTES };

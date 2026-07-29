// Logique de rappel automatique (T-15min) et de calcul des retards par poste.
// Aucun cron externe requis : ces fonctions sont appelées à chaque consultation
// de la file (polling existant de /agent et /display), ce qui suffit à déclencher
// les transitions en temps quasi-réel sans complexifier le déploiement Render.
const prisma = require('../config/db');

const ADMISSION_LEAD_MINUTES = 15;
const CALL_REPLAY_INTERVAL_MINUTES = 1;
const CALL_REPLAY_MAX_COUNT = 3;

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

// Répète automatiquement l'annonce d'appel (chime + voix sur /display) pour tout
// candidat CALLED n'ayant pas encore atteint 3 diffusions, une minute après la
// précédente. S'arrête de lui-même une fois le candidat marqué Terminé/Absent
// (son statut change alors et sort du filtre ci-dessous), ou après 3 diffusions.
async function autoReplayCalls(dateStr) {
  const { start, end } = dayRange(dateStr);
  const now = new Date();
  const cutoff = new Date(now.getTime() - CALL_REPLAY_INTERVAL_MINUTES * 60000);

  const due = await prisma.candidate.findMany({
    where: {
      datePassage: { gte: start, lt: end },
      statut: 'CALLED',
      callCount: { lt: CALL_REPLAY_MAX_COUNT },
      lastCalledAt: { lte: cutoff },
    },
  });

  for (const c of due) {
    await prisma.candidate.update({
      where: { id: c.id },
      data: { callCount: { increment: 1 }, lastCalledAt: now },
    });
  }

  return due.length;
}

module.exports = {
  promoteDueForAdmission,
  computeOverrunMinutes,
  annotateWithDelays,
  autoReplayCalls,
  ADMISSION_LEAD_MINUTES,
  CALL_REPLAY_MAX_COUNT,
};

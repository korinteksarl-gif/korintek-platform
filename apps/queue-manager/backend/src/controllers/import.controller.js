const XLSX = require('xlsx');
const prisma = require('../config/db');
const { generateCandidateNumber } = require('../utils/candidateNumber');
const { logAction } = require('../utils/audit');

// Colonnes attendues (insensible à la casse/accents de base) : Nom, Prenom, Email, Telephone, Examen, Heure
function normalizeRow(row) {
  const get = (keys) => {
    for (const k of Object.keys(row)) {
      if (keys.includes(k.trim().toLowerCase())) return row[k];
    }
    return undefined;
  };
  return {
    nom: get(['nom']),
    prenom: get(['prenom', 'prénom']),
    email: get(['email']),
    telephone: get(['telephone', 'téléphone', 'tel']),
    examen: get(['examen']),
    heure: get(['heure', 'heure_convocation']),
  };
}

// POST /api/v1/import/candidates
// multipart/form-data, champ "file" (xlsx/csv), champ texte "datePassage" (YYYY-MM-DD)
async function importCandidates(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier reçu (champ "file").' });
    }
    const datePassage = req.body.datePassage || new Date().toISOString().slice(0, 10);

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const errors = [];
    const created = [];

    for (let i = 0; i < rows.length; i++) {
      const r = normalizeRow(rows[i]);
      if (!r.nom || !r.prenom || !r.examen || !r.heure) {
        errors.push({ ligne: i + 2, raison: 'Champs requis manquants (Nom, Prenom, Examen, Heure).' });
        continue;
      }

      const numero = await generateCandidateNumber(datePassage);
      const candidate = await prisma.candidate.create({
        data: {
          numero,
          nom: String(r.nom).trim(),
          prenom: String(r.prenom).trim(),
          email: r.email ? String(r.email).trim() : null,
          telephone: r.telephone ? String(r.telephone).trim() : null,
          examen: String(r.examen).trim(),
          datePassage: new Date(datePassage),
          heureConvocation: String(r.heure).trim(),
        },
      });
      created.push(candidate);
    }

    await logAction(req.user?.id, 'IMPORT_CANDIDATES', {
      fichier: req.file.originalname,
      importes: created.length,
      erreurs: errors.length,
    });

    res.status(201).json({ importes: created.length, candidates: created, erreurs: errors });
  } catch (err) {
    next(err);
  }
}

module.exports = { importCandidates };

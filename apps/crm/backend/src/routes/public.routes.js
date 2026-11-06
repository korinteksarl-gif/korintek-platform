// Demandes reçues depuis korintek.com (formulaire « Inscription rapide »)
// → contact « Prospect formation », étape NOUVEAU, source « Site web ».
// Route publique : CORS limité au site, anti-spam (champ piège + limite de débit),
// et dédoublonnage par téléphone/email (une nouvelle note au lieu d'un doublon).
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const prisma = require('../config/db');
const { logAction } = require('../utils/audit');

const router = express.Router();

const PUBLIC_ORIGINS = (process.env.PUBLIC_ORIGINS || 'https://korintek.com,https://www.korintek.com')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

router.use(cors({ origin: PUBLIC_ORIGINS, methods: ['POST', 'OPTIONS'] }));

const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de demandes. Écrivez-nous sur WhatsApp au +228 99 25 26 26.' },
});

const clean = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const digits = (v) => clean(v, 40).replace(/\D/g, '');

router.post('/leads', leadLimiter, async (req, res, next) => {
  try {
    if (clean(req.body.website)) return res.status(201).json({ ok: true }); // champ piège rempli = robot

    const fullName = clean(req.body.nom, 150);
    const telephone = clean(req.body.telephone, 30);
    const email = clean(req.body.email, 150).toLowerCase();
    const formation = clean(req.body.formation, 150);
    const mode = clean(req.body.mode, 40);
    const message = clean(req.body.message, 1000);

    if (!fullName || !formation) return res.status(400).json({ error: 'Nom et formation requis.' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Format d'email invalide." });

    const [prenom, ...rest] = fullName.split(/\s+/);
    const nom = rest.join(' ') || prenom;
    const note = [
      `Demande via korintek.com — ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Lome' })}`,
      `Formation / examen : ${formation}`,
      mode && `Format : ${mode}`,
      message && `Message : ${message}`,
    ].filter(Boolean).join('\n');

    // Dédoublonnage : même téléphone (8 derniers chiffres) ou même email, contact encore ouvert
    const tel8 = digits(telephone).slice(-8);
    // Les numéros sont saisis sous des formes variées (+228 90 11 22 33, 90112233…) :
    // on compare les 8 derniers chiffres côté serveur.
    const open = (tel8 || email)
      ? await prisma.contact.findMany({
          where: {
            stage: { notIn: ['GAGNE', 'PERDU'] },
            OR: [{ telephone: { not: null } }, ...(email ? [{ email: { equals: email, mode: 'insensitive' } }] : [])],
          },
          orderBy: { updatedAt: 'desc' },
          take: 2000,
        })
      : [];
    const candidates = open.filter(
      (c) => (tel8 && digits(c.telephone).slice(-8) === tel8) || (email && (c.email || '').toLowerCase() === email),
    );

    if ((tel8 || email) && candidates.length) {
      const existing = candidates[0];
      await prisma.interaction.create({ data: { contactId: existing.id, type: 'NOTE', notes: note } });
      await prisma.contact.update({ where: { id: existing.id }, data: { updatedAt: new Date() } });
      await logAction(null, 'WEB_LEAD_MERGED', { contactId: existing.id });
      return res.status(201).json({ ok: true });
    }

    const contact = await prisma.contact.create({
      data: {
        nom,
        prenom: rest.length ? prenom : null,
        email: email || null,
        telephone: telephone || null,
        type: 'PROSPECT_FORMATION',
        stage: 'NOUVEAU',
        source: 'Site web',
        notes: note,
      },
    });
    await logAction(null, 'WEB_LEAD_CREATED', { contactId: contact.id, formation });
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

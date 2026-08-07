// Crée le compte administrateur de secours et un plan comptable de départ,
// inspiré du référentiel OHADA (norme comptable en zone UEMOA/Togo), adapté
// à l'activité de KORINTEK. Idempotent : peut être relancé sans dupliquer.
// ⚠️ Ce plan comptable est un point de départ, pas une garantie de conformité
// fiscale — à faire valider/ajuster avec un expert-comptable.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_ACCOUNTS = [
  { code: '101000', name: 'Capital social', type: 'CAPITAUX_PROPRES' },
  { code: '120000', name: 'Résultat de l\'exercice', type: 'CAPITAUX_PROPRES' },
  { code: '401000', name: 'Fournisseurs', type: 'PASSIF' },
  { code: '411000', name: 'Clients', type: 'ACTIF' },
  { code: '447000', name: 'État — impôts et taxes', type: 'PASSIF' },
  { code: '512000', name: 'Banque', type: 'ACTIF' },
  { code: '514000', name: 'Mobile Money', type: 'ACTIF' },
  { code: '571000', name: 'Caisse', type: 'ACTIF' },
  { code: '601000', name: 'Achats de fournitures', type: 'CHARGE' },
  { code: '613000', name: 'Locations', type: 'CHARGE' },
  { code: '622000', name: 'Rémunérations des formateurs', type: 'CHARGE' },
  { code: '626000', name: 'Frais de télécommunication', type: 'CHARGE' },
  { code: '641000', name: 'Salaires du personnel', type: 'CHARGE' },
  { code: '706000', name: 'Prestations de services — Certifications', type: 'PRODUIT' },
  { code: '706100', name: 'Prestations de services — Formations', type: 'PRODUIT' },
];

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@korintek.com').toLowerCase();

  const existingUser = await prisma.staffUser.findUnique({ where: { email } });
  if (!existingUser) {
    const user = await prisma.staffUser.create({
      data: { email, nom: 'Admin', prenom: 'KORINTEK', role: 'SUPER_ADMIN', active: true },
    });
    console.log(`Compte de secours créé : ${user.email} (SUPER_ADMIN)`);
  } else {
    console.log(`Compte de secours déjà présent : ${email}`);
  }

  for (const acc of DEFAULT_ACCOUNTS) {
    const existing = await prisma.account.findUnique({ where: { code: acc.code } });
    if (!existing) {
      await prisma.account.create({ data: acc });
      console.log(`Compte créé : ${acc.code} — ${acc.name}`);
    }
  }
  console.log('Plan comptable de base vérifié/créé.');
}

main()
  .catch((err) => {
    console.error('Erreur lors du seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

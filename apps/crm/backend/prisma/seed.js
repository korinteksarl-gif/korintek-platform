// Crée (ou met à jour) le compte administrateur de secours local, utilisé
// pour se reconnecter en cas de panne SSO. Idempotent : peut être relancé
// à chaque déploiement sans dupliquer ni écraser un compte déjà personnalisé.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@korintek.com').toLowerCase();

  const existing = await prisma.staffUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Compte de secours déjà présent : ${email} (rôle actuel : ${existing.role})`);
    return;
  }

  const user = await prisma.staffUser.create({
    data: {
      email,
      nom: 'Admin',
      prenom: 'KORINTEK',
      role: 'SUPER_ADMIN',
      active: true,
    },
  });
  console.log(`Compte de secours créé : ${user.email} (SUPER_ADMIN)`);
}

main()
  .catch((err) => {
    console.error('Erreur lors du seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

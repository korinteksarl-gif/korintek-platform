// Crée le compte administrateur initial (SUPER_ADMIN)
// Exécution: npm run prisma:seed
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@korintek.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'ChangeMoi123!';
  const nom = process.env.SEED_ADMIN_NOM || 'Admin';
  const prenom = process.env.SEED_ADMIN_PRENOM || 'Korintek';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Le compte ${email} existe déjà. Aucune action.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, passwordHash, nom, prenom, role: 'SUPER_ADMIN', active: true },
  });

  console.log('Compte administrateur créé :');
  console.log(`  Email    : ${user.email}`);
  console.log(`  Mot de passe : ${password} (à changer immédiatement après première connexion)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

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
  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { passwordHash, role: 'SUPER_ADMIN', active: true },
    });
    console.log(`Le compte ${email} existait déjà — mot de passe mis à jour avec la valeur actuelle de SEED_ADMIN_PASSWORD.`);
    return;
  }

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

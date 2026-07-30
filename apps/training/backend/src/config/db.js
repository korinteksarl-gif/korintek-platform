const { PrismaClient } = require('@prisma/client');
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.prismaTraining ||
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prismaTraining = prisma;
}

module.exports = prisma;

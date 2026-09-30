// Istanza unica di Prisma Client, condivisa da tutta l'applicazione.
// Con Prisma 7 la connessione a Postgres passa dal driver adapter @prisma/adapter-pg.
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL non impostata (vedi .env)');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;

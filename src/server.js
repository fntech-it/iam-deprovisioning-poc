require('dotenv/config');

const app = require('./app');
const prisma = require('./db');

// Render imposta PORT automaticamente; in locale si usa 3000
const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server in ascolto su http://localhost:${PORT}`);
});

async function chiudi(segnale) {
  console.log(`${segnale} ricevuto, chiusura in corso...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => chiudi('SIGINT'));
process.on('SIGTERM', () => chiudi('SIGTERM'));

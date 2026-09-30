// Dati fittizi di prova per ruoli e permessi (nessuna utenza).
// Rieseguibile: non crea duplicati. Avvio: npm run seed
require('dotenv/config');
const prisma = require('../src/db');

const PERMESSI = [
  { nome: 'posta.lettura', descrizione: 'Lettura della casella di posta' },
  { nome: 'posta.invio', descrizione: 'Invio di email' },
  { nome: 'crm.lettura', descrizione: 'Consultazione anagrafiche clienti' },
  { nome: 'crm.scrittura', descrizione: 'Modifica anagrafiche clienti' },
  { nome: 'hr.anagrafica', descrizione: 'Accesso alle anagrafiche del personale' },
  { nome: 'admin.sistema', descrizione: 'Amministrazione dei sistemi' },
];

const RUOLI = [
  { nome: 'Dipendente', descrizione: 'Profilo base', permessi: ['posta.lettura', 'posta.invio'] },
  { nome: 'Commerciale', descrizione: 'Area vendite', permessi: ['posta.lettura', 'crm.lettura', 'crm.scrittura'] },
  { nome: 'HR', descrizione: 'Risorse umane', permessi: ['posta.lettura', 'hr.anagrafica'] },
  { nome: 'Amministratore', descrizione: 'IT', permessi: ['admin.sistema'] },
];

async function main() {
  const idPermessi = {};
  for (const p of PERMESSI) {
    // nome permesso non è @unique nello schema: cerca prima di creare
    const esistente = await prisma.permesso.findFirst({ where: { nome: p.nome } });
    const permesso = esistente ?? (await prisma.permesso.create({ data: p }));
    idPermessi[p.nome] = permesso.id;
  }

  for (const r of RUOLI) {
    const permessi = r.permessi.map((nome) => ({ id: idPermessi[nome] }));
    const ruolo = await prisma.ruolo.upsert({
      where: { nome: r.nome },
      create: { nome: r.nome, descrizione: r.descrizione, permessi: { connect: permessi } },
      update: { descrizione: r.descrizione, permessi: { set: permessi } },
    });
    console.log(`Ruolo ${ruolo.id} ${ruolo.nome}: ${r.permessi.join(', ')}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

const express = require('express');
const prisma = require('../db');
const { HttpError, parseId, parseIdArray } = require('../errori');

const router = express.Router();

const CAMPI = ['nome', 'descrizione'];

// Permessi del ruolo + numero di utenze a cui è assegnato
const includeElenco = {
  permessi: { orderBy: { nome: 'asc' } },
  _count: { select: { utenze: true } },
};

// Nel dettaglio servono anche le utenze assegnate
const includeDettaglio = {
  permessi: { orderBy: { nome: 'asc' } },
  utenze: {
    orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
    select: { id: true, username: true, nome: true, cognome: true, stato: true },
  },
};

// Valida il body di creazione/modifica. Con parziale = true (PUT) i campi
// sono facoltativi, ma ne serve almeno uno. creatoDaImport non è impostabile:
// lo valorizza solo l'import CSV.
function validaRuolo(body, { parziale }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Body JSON mancante o non valido');
  }

  const nonAmmessi = Object.keys(body).filter((c) => !CAMPI.includes(c));
  if (nonAmmessi.length > 0) {
    throw new HttpError(400, `Campi non ammessi: ${nonAmmessi.join(', ')}`, { campiAmmessi: CAMPI });
  }

  const dati = {};
  const errori = [];

  if (body.nome === undefined) {
    if (!parziale) errori.push({ campo: 'nome', messaggio: 'obbligatorio' });
  } else if (typeof body.nome !== 'string' || body.nome.trim() === '') {
    errori.push({ campo: 'nome', messaggio: 'deve essere una stringa non vuota' });
  } else {
    dati.nome = body.nome.trim();
  }

  // descrizione facoltativa: null o stringa vuota la cancellano
  if (body.descrizione !== undefined) {
    if (body.descrizione !== null && typeof body.descrizione !== 'string') {
      errori.push({ campo: 'descrizione', messaggio: 'deve essere una stringa o null' });
    } else {
      dati.descrizione = body.descrizione?.trim() || null;
    }
  }

  if (errori.length > 0) {
    throw new HttpError(400, 'Dati non validi', errori);
  }
  if (parziale && Object.keys(dati).length === 0) {
    throw new HttpError(400, `Nessun campo da modificare (ammessi: ${CAMPI.join(', ')})`);
  }

  return dati;
}

// Il nome deve restare univoco. Il confronto ignora maiuscole/minuscole, per
// evitare ruoli quasi identici come "HR" e "hr".
async function verificaNomeUnivoco(nome, escludiId) {
  if (nome === undefined) return;

  const esistente = await prisma.ruolo.findFirst({
    where: {
      nome: { equals: nome, mode: 'insensitive' },
      ...(escludiId !== undefined && { id: { not: escludiId } }),
    },
    select: { id: true, nome: true },
  });
  if (esistente) {
    throw new HttpError(409, `Esiste già un ruolo con nome "${esistente.nome}"`, [
      { campo: 'nome', messaggio: 'già in uso', ruoloId: esistente.id },
    ]);
  }
}

function formattaElenco({ _count, ...ruolo }) {
  return { ...ruolo, utenzeAssegnate: _count.utenze };
}

async function trovaRuolo(id, include = includeDettaglio) {
  const ruolo = await prisma.ruolo.findUnique({ where: { id }, include });
  if (!ruolo) throw new HttpError(404, `Ruolo ${id} non trovato`);
  return ruolo;
}

// POST /ruoli — crea un ruolo (creatoDaImport = false)
router.post('/', async (req, res) => {
  const dati = validaRuolo(req.body, { parziale: false });
  await verificaNomeUnivoco(dati.nome);

  const ruolo = await prisma.ruolo.create({ data: dati, include: includeDettaglio });
  res.status(201).json(ruolo);
});

// GET /ruoli — elenco con permessi associati e flag creatoDaImport (badge)
router.get('/', async (req, res) => {
  const ruoli = await prisma.ruolo.findMany({ orderBy: { nome: 'asc' }, include: includeElenco });
  res.json(ruoli.map(formattaElenco));
});

// GET /ruoli/:id — dettaglio con permessi e utenze assegnate
router.get('/:id', async (req, res) => {
  res.json(await trovaRuolo(parseId(req.params.id)));
});

// PUT /ruoli/:id — modifica nome e/o descrizione
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const dati = validaRuolo(req.body, { parziale: true });
  await trovaRuolo(id);
  await verificaNomeUnivoco(dati.nome, id);

  const ruolo = await prisma.ruolo.update({ where: { id }, data: dati, include: includeDettaglio });
  res.json(ruolo);
});

// POST /ruoli/:id/permessi — assegna uno o più permessi. Body: { "permessoIds": [1, 2] }
router.post('/:id/permessi', async (req, res) => {
  const id = parseId(req.params.id);
  const idUnivoci = parseIdArray(req.body?.permessoIds, 'permessoIds');
  await trovaRuolo(id);

  const permessi = await prisma.permesso.findMany({
    where: { id: { in: idUnivoci } },
    select: { id: true },
  });
  const mancanti = idUnivoci.filter((p) => !permessi.some((trovato) => trovato.id === p));
  if (mancanti.length > 0) {
    throw new HttpError(404, `Permessi non trovati: ${mancanti.join(', ')}`);
  }

  // connect è idempotente: un permesso già associato viene semplicemente ignorato
  const ruolo = await prisma.ruolo.update({
    where: { id },
    data: { permessi: { connect: idUnivoci.map((p) => ({ id: p })) } },
    include: includeDettaglio,
  });
  res.json(ruolo);
});

// DELETE /ruoli/:id/permessi/:permessoId — rimuove un permesso dal ruolo
router.delete('/:id/permessi/:permessoId', async (req, res) => {
  const id = parseId(req.params.id);
  const permessoId = parseId(req.params.permessoId, 'permessoId');

  const ruolo = await trovaRuolo(id);
  if (!ruolo.permessi.some((p) => p.id === permessoId)) {
    throw new HttpError(404, `Il permesso ${permessoId} non è associato al ruolo ${id}`);
  }

  const aggiornato = await prisma.ruolo.update({
    where: { id },
    data: { permessi: { disconnect: { id: permessoId } } },
    include: includeDettaglio,
  });
  res.json(aggiornato);
});

// DELETE /ruoli/:id — se il ruolo è assegnato a utenze attive risponde 409
// con l'avviso e l'elenco; per procedere comunque: DELETE /ruoli/:id?conferma=true
router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const ruolo = await trovaRuolo(id);
  const utenzeAttive = ruolo.utenze.filter((u) => u.stato === 'attivo');

  if (utenzeAttive.length > 0 && req.query.conferma !== 'true') {
    return res.status(409).json({
      errore: `Il ruolo "${ruolo.nome}" è assegnato a ${utenzeAttive.length} utenze attive, che perderanno i relativi permessi`,
      avviso: true,
      utenzeAttive,
      conferma: `Per eliminare comunque: DELETE /ruoli/${id}?conferma=true`,
    });
  }

  // le assegnazioni a utenze e permessi spariscono in cascata
  await prisma.ruolo.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;

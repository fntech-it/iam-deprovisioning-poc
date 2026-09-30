const express = require('express');
const prisma = require('../db');
const { HttpError, parseId } = require('../errori');
const { permessiDerivati } = require('../permessi');

const router = express.Router();

const CAMPI_ANAGRAFICA = ['username', 'nome', 'cognome', 'email'];
const ORIGINI = ['manuale', 'import'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Ruoli dell'utenza con i rispettivi permessi, per calcolare quelli derivati
const includeRuoli = {
  ruoli: {
    orderBy: { nome: 'asc' },
    include: { permessi: { orderBy: { nome: 'asc' } } },
  },
};

// Valida il body di creazione/modifica. Con parziale = true (PUT) i campi
// sono facoltativi, ma ne serve almeno uno.
function validaAnagrafica(body, { parziale, campiAmmessi }) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Body JSON mancante o non valido');
  }

  const nonAmmessi = Object.keys(body).filter((c) => !campiAmmessi.includes(c));
  if (nonAmmessi.length > 0) {
    throw new HttpError(400, `Campi non ammessi: ${nonAmmessi.join(', ')}`, {
      campiAmmessi,
    });
  }

  const dati = {};
  const errori = [];

  for (const campo of CAMPI_ANAGRAFICA) {
    const valore = body[campo];
    if (valore === undefined) {
      if (!parziale) errori.push({ campo, messaggio: 'obbligatorio' });
      continue;
    }
    if (typeof valore !== 'string' || valore.trim() === '') {
      errori.push({ campo, messaggio: 'deve essere una stringa non vuota' });
      continue;
    }
    dati[campo] = valore.trim();
  }

  if (dati.email !== undefined) {
    dati.email = dati.email.toLowerCase();
    if (!EMAIL_REGEX.test(dati.email)) {
      errori.push({ campo: 'email', messaggio: 'formato non valido' });
    }
  }

  if (body.origine !== undefined) {
    if (!ORIGINI.includes(body.origine)) {
      errori.push({ campo: 'origine', messaggio: `valori ammessi: ${ORIGINI.join(', ')}` });
    } else {
      dati.origine = body.origine;
    }
  }

  if (errori.length > 0) {
    throw new HttpError(400, 'Dati non validi', errori);
  }
  if (parziale && Object.keys(dati).length === 0) {
    throw new HttpError(400, `Nessun campo da modificare (ammessi: ${campiAmmessi.join(', ')})`);
  }

  return dati;
}

// Username ed email devono restare univoci: controllo esplicito per dare un
// messaggio chiaro (il vincolo @unique del DB resta comunque la garanzia finale)
async function verificaUnicita({ username, email }, escludiId) {
  const condizioni = [];
  if (username !== undefined) condizioni.push({ username });
  if (email !== undefined) condizioni.push({ email });
  if (condizioni.length === 0) return;

  const esistenti = await prisma.utenza.findMany({
    where: {
      OR: condizioni,
      ...(escludiId !== undefined && { id: { not: escludiId } }),
    },
    select: { username: true, email: true },
  });

  const errori = [];
  if (username !== undefined && esistenti.some((u) => u.username === username)) {
    errori.push({ campo: 'username', messaggio: `username "${username}" già in uso` });
  }
  if (email !== undefined && esistenti.some((u) => u.email === email)) {
    errori.push({ campo: 'email', messaggio: `email "${email}" già in uso` });
  }
  if (errori.length > 0) {
    throw new HttpError(409, 'Username o email già in uso', errori);
  }
}

function formattaDettaglio(utenza) {
  const { ruoli, ...anagrafica } = utenza;
  return {
    ...anagrafica,
    ruoli: ruoli.map(({ permessi, ...ruolo }) => ruolo),
    permessi: permessiDerivati(ruoli),
  };
}

async function trovaUtenza(id, client = prisma) {
  const utenza = await client.utenza.findUnique({ where: { id }, include: includeRuoli });
  if (!utenza) throw new HttpError(404, `Utenza ${id} non trovata`);
  return utenza;
}

// POST /utenze — crea un'utenza, sempre in stato "attivo"
router.post('/', async (req, res) => {
  const dati = validaAnagrafica(req.body, {
    parziale: false,
    campiAmmessi: [...CAMPI_ANAGRAFICA, 'origine'],
  });
  await verificaUnicita(dati);

  const utenza = await prisma.utenza.create({
    data: { ...dati, stato: 'attivo' },
    include: includeRuoli,
  });
  res.status(201).json(formattaDettaglio(utenza));
});

// GET /utenze — elenco con stato corrente
router.get('/', async (req, res) => {
  const utenze = await prisma.utenza.findMany({
    orderBy: [{ cognome: 'asc' }, { nome: 'asc' }],
  });
  res.json(utenze);
});

// GET /utenze/:id — anagrafica + ruoli + permessi derivati
router.get('/:id', async (req, res) => {
  const utenza = await trovaUtenza(parseId(req.params.id));
  res.json(formattaDettaglio(utenza));
});

// PUT /utenze/:id — modifica anagrafica (stato e origine non modificabili qui)
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const dati = validaAnagrafica(req.body, { parziale: true, campiAmmessi: CAMPI_ANAGRAFICA });
  await trovaUtenza(id);
  await verificaUnicita(dati, id);

  const utenza = await prisma.utenza.update({ where: { id }, data: dati, include: includeRuoli });
  res.json(formattaDettaglio(utenza));
});

// POST /utenze/:id/ruoli — assegna uno o più ruoli. Body: { "ruoloIds": [1, 2] }
router.post('/:id/ruoli', async (req, res) => {
  const id = parseId(req.params.id);
  const ruoloIds = req.body?.ruoloIds;

  if (
    !Array.isArray(ruoloIds) ||
    ruoloIds.length === 0 ||
    !ruoloIds.every((r) => Number.isInteger(r) && r > 0)
  ) {
    throw new HttpError(400, '"ruoloIds" deve essere un array non vuoto di id interi positivi');
  }
  const idUnivoci = [...new Set(ruoloIds)];

  const utenza = await trovaUtenza(id);
  if (utenza.stato === 'deprovisioned') {
    throw new HttpError(409, 'Impossibile assegnare ruoli a un\'utenza deprovisioned');
  }

  const ruoli = await prisma.ruolo.findMany({ where: { id: { in: idUnivoci } }, select: { id: true } });
  const mancanti = idUnivoci.filter((r) => !ruoli.some((trovato) => trovato.id === r));
  if (mancanti.length > 0) {
    throw new HttpError(404, `Ruoli non trovati: ${mancanti.join(', ')}`);
  }

  // connect è idempotente: un ruolo già assegnato viene semplicemente ignorato
  const aggiornata = await prisma.utenza.update({
    where: { id },
    data: { ruoli: { connect: idUnivoci.map((r) => ({ id: r })) } },
    include: includeRuoli,
  });
  res.json(formattaDettaglio(aggiornata));
});

// DELETE /utenze/:id/ruoli/:ruoloId — rimuove un ruolo dall'utenza
router.delete('/:id/ruoli/:ruoloId', async (req, res) => {
  const id = parseId(req.params.id);
  const ruoloId = parseId(req.params.ruoloId, 'ruoloId');

  const utenza = await trovaUtenza(id);
  if (!utenza.ruoli.some((r) => r.id === ruoloId)) {
    throw new HttpError(404, `Il ruolo ${ruoloId} non è assegnato all'utenza ${id}`);
  }

  const aggiornata = await prisma.utenza.update({
    where: { id },
    data: { ruoli: { disconnect: { id: ruoloId } } },
    include: includeRuoli,
  });
  res.json(formattaDettaglio(aggiornata));
});

// POST /utenze/:id/deprovisiona — stato "deprovisioned" + revoca di tutti i
// ruoli; risponde con i permessi persi (quelli posseduti prima e non più dopo)
router.post('/:id/deprovisiona', async (req, res) => {
  const id = parseId(req.params.id);

  const esito = await prisma.$transaction(async (tx) => {
    const prima = await trovaUtenza(id, tx);
    if (prima.stato === 'deprovisioned') {
      throw new HttpError(409, `Utenza ${id} già deprovisioned`);
    }

    const dopo = await tx.utenza.update({
      where: { id },
      data: { stato: 'deprovisioned', ruoli: { set: [] } },
      include: includeRuoli,
    });

    const permessiDopo = new Set(permessiDerivati(dopo.ruoli).map((p) => p.id));
    const permessiPersi = permessiDerivati(prima.ruoli).filter((p) => !permessiDopo.has(p.id));

    return {
      utenza: formattaDettaglio(dopo),
      statoPrecedente: prima.stato,
      ruoliRimossi: prima.ruoli.map(({ permessi, ...ruolo }) => ruolo),
      permessiPersi,
    };
  });

  res.json(esito);
});

// DELETE /utenze/:id — cancellazione fisica (le assegnazioni ai ruoli spariscono in cascata)
router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  await trovaUtenza(id);
  await prisma.utenza.delete({ where: { id } });
  res.status(204).end();
});

module.exports = router;

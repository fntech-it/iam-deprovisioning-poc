const express = require('express');
const prisma = require('./db');
const { HttpError } = require('./errori');
const utenzeRouter = require('./routes/utenze');

const app = express();

app.use(express.json());

// Stato del server + verifica della connessione al database
app.get('/health', async (req, res) => {
  const risposta = {
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  try {
    const utenze = await prisma.utenza.count();
    risposta.database = { status: 'ok', utenze };
    res.json(risposta);
  } catch (err) {
    console.error('Health check: database non raggiungibile', err);
    risposta.status = 'error';
    risposta.database = { status: 'error', message: err.message };
    res.status(503).json(risposta);
  }
});

app.use('/utenze', utenzeRouter);

app.use((req, res) => {
  res.status(404).json({ errore: `Rotta non trovata: ${req.method} ${req.path}` });
});

// Gestione centralizzata degli errori (Express 5 inoltra qui anche i rifiuti async)
app.use((err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ errore: err.message, dettagli: err.dettagli });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ errore: 'JSON non valido nel body della richiesta' });
  }
  // Vincolo di unicità violato in concorrenza (dopo il controllo applicativo)
  if (err.code === 'P2002') {
    return res.status(409).json({ errore: 'Username o email già in uso' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ errore: 'Record non trovato' });
  }
  console.error(err);
  res.status(500).json({ errore: 'Errore interno del server' });
});

module.exports = app;

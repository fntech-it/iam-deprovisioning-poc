const express = require('express');
const prisma = require('./db');

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

module.exports = app;

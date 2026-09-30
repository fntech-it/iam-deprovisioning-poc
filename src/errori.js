// Errore applicativo con codice HTTP, gestito dal middleware in app.js
class HttpError extends Error {
  constructor(status, messaggio, dettagli) {
    super(messaggio);
    this.status = status;
    this.dettagli = dettagli;
  }
}

// Converte un parametro di rotta in id intero positivo, altrimenti 400
function parseId(valore, nome = 'id') {
  const id = Number(valore);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `Parametro "${nome}" non valido: deve essere un intero positivo`);
  }
  return id;
}

// Valida un array di id nel body (es. "ruoloIds") e lo restituisce senza duplicati
function parseIdArray(valore, nome) {
  if (
    !Array.isArray(valore) ||
    valore.length === 0 ||
    !valore.every((id) => Number.isInteger(id) && id > 0)
  ) {
    throw new HttpError(400, `"${nome}" deve essere un array non vuoto di id interi positivi`);
  }
  return [...new Set(valore)];
}

module.exports = { HttpError, parseId, parseIdArray };

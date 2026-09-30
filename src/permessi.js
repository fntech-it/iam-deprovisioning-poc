// Calcolo dei permessi derivati: un'utenza possiede un permesso se almeno
// uno dei suoi ruoli lo include. Ogni permesso compare una sola volta, con
// l'elenco dei ruoli tramite cui è ottenuto.
function permessiDerivati(ruoli) {
  const perId = new Map();

  for (const ruolo of ruoli) {
    for (const permesso of ruolo.permessi) {
      if (!perId.has(permesso.id)) {
        perId.set(permesso.id, {
          id: permesso.id,
          nome: permesso.nome,
          descrizione: permesso.descrizione,
          tramite: [],
        });
      }
      perId.get(permesso.id).tramite.push(ruolo.nome);
    }
  }

  return [...perId.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

module.exports = { permessiDerivati };

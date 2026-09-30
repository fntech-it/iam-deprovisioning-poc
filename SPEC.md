# Specifica funzionale v1 — Tool di Deprovisioning IAM (PoC)

Obiettivo didattico: esplorare il modello dati IAM (utenze, ruoli, permessi, accessi derivati) e il processo di reconciliation/deprovisioning. Uso singolo utente, ambiente di collaudo, dati fittizi.

---

## Stack tecnico

- **Backend**: Node.js + Express
- **Frontend**: React (senza framework aggiuntivi tipo Next.js)
- **Database**: PostgreSQL su Neon
- **ORM**: Prisma
- **Autenticazione**: nessuna (v1) — singolo utente, ambiente di test
- **Deploy di collaudo**: backend su Render (Free), DB su Neon (Free)

---

## Modello dati

### Utenza

- id
- username (univoco)
- nome
- cognome
- email
- stato: `attivo` | `sospeso` | `deprovisioned`
- data creazione
- origine: `manuale` | `import` (per tracciabilità)

### Ruolo

- id
- nome (univoco)
- descrizione
- creato_da_import: booleano (per il badge di evidenza)

### Permesso

- id
- nome
- descrizione

### Relazioni

- Ruolo ↔ Permesso: molti-a-molti
- Utenza ↔ Ruolo: molti-a-molti

---

## Operazioni — Gestione Utenze

- Creare una nuova utenza manualmente
- Elenco utenze con stato corrente
- Dettaglio utenza: anagrafica + ruoli assegnati + permessi derivati (calcolati dai ruoli)
- Modificare anagrafica utenza
- Assegnare/rimuovere ruoli a un'utenza
- **Deprovisionare** un'utenza: azione dedicata → stato = `deprovisioned`, mostra a schermo i permessi persi come conseguenza
- Eliminare un'utenza (cancellazione fisica, distinta dal deprovisioning)

## Operazioni — Gestione Ruoli

- Creare, modificare, eliminare un ruolo
- Elenco ruoli con permessi associati e badge "creato da import" se applicabile
- Assegnare/rimuovere permessi a un ruolo
- Eliminazione con avviso se il ruolo è assegnato a utenze attive

## Operazioni — Gestione Permessi

- Creare, modificare, eliminare un permesso
- Elenco permessi

## Vista trasversale

- Per ogni permesso: elenco delle utenze che lo possiedono (via ruoli) — vista tipo "audit accessi"

---

## Import CSV / Reconciliation

### Formato file

- Separatore: punto e virgola (`;`)
- Colonne, in ordine: `username; nome; cognome; email; ruolo`
- Prima riga: intestazione (header)
- Encoding: UTF-8

### Logica di matching

1. Match automatico per `username` esatto (chiave primaria di confronto)
2. Righe senza match esatto → schermata "da verificare": il sistema propone suggerimenti per similarità su nome/cognome (confronto semplice, non fuzzy-matching avanzato), ma **la decisione è sempre manuale**

### Gestione ruolo mancante

- Se il valore in `ruolo` non esiste a sistema, viene **creato automaticamente** e marcato con `creato_da_import = true`

### Risultato dell'import

Il sistema presenta tre liste, senza applicare automaticamente alcuna modifica:

- **Nuovi**: utenze nel CSV non presenti a sistema → azione manuale: crea
- **Invariati**: utenze già matchate correttamente → nessuna azione richiesta
- **Assenti dal nuovo file**: utenze a sistema non presenti nel CSV importato → azione manuale: deprovisiona (o ignora)

Nessuna modifica allo stato delle utenze avviene automaticamente in seguito a un import: ogni azione (creazione, deprovisioning) richiede conferma manuale dall'operatore, riga per riga o in blocco.

---

## Cose escluse volutamente dalla v1 (promemoria)

- Autenticazione/login
- Integrazioni con sistemi esterni reali (SCIM, Azure AD, Okta...)
- Flussi di approvazione multi-step
- Fuzzy matching avanzato (Levenshtein o simili)
- Storicizzazione/audit trail persistente delle modifiche (valutabile in v2)
- Archiviazione soft invece di cancellazione fisica (valutabile in v2)
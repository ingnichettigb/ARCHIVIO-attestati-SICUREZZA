# Attestation Hub

ARCHIVIO ATTESTATI NUOVA SAAS Il prompt è strutturato per ottenere:

DB relazionale completo

Backend Node/Express modulare

Frontend React con due interfacce (Mobile Dipendente + Desktop HR)

Gestione immagini simulata

Calcolo automatico scadenze

Validazione attestati

Email di feedback simulata

Campi aggiuntivi richiesti: luogo di nascita, data di nascita, email, codice_fiscale come FK in attestati

PROMPT PER LOVABLE (versione finale)

Crea una applicazione web Full‑Stack per la gestione e archiviazione degli attestati di formazione sulla sicurezza nei luoghi di lavoro (D.Lgs. 81/2008).

1. Database relazionale

Genera un database con le seguenti tabelle:

Tabella dipendenti

Campi:

id (PK)

codice_fiscale (VARCHAR(16), UNIQUE)

cognome

nome

email

reparto

luogo_nascita

data_nascita

created_at

updated_at

Tabella tipi_corso

Campi:

id (PK)

nome_corso

macro_categoria (es. Sicurezza Lavoratori, Antincendio, Primo Soccorso)

livello_specifico (Base, Specifico, Aggiornamento)

ore_minime_legge

durata_validita_anni (NULL = senza scadenza)

created_at

updated_at

Pre‑popola la tabella con:

Sicurezza Generale — 4 ore — senza scadenza

Sicurezza Specifica Rischio Basso — 4 ore — 5 anni

Antincendio Livello 1 Base — 4 ore — 5 anni

Primo Soccorso Gruppo B/C Base — 12 ore — 3 anni

Tabella attestati_caricati

Campi:

id (PK)

dipendente_id (FK → dipendenti.id)

codice_fiscale (FK → dipendenti.codice_fiscale)

tipo_corso_id (FK → tipi_corso.id)

data_corso

data_scadenza_calcolata

ore_dichiarate

url_foto_fronte

url_foto_retro

stato_validazione (In attesa, Approvato, Respinto)

note_rifiuto

data_validazione

created_at

updated_at

Regola scadenza: Se durata_validita_anni > 0 → data_scadenza_calcolata = data_corso + durata_validita_anni. Se NULL/0 → scadenza = NULL.

2. Backend (Node.js + Express)

Genera un backend modulare con:

Struttura cartelle

Codice

backend/

  src/

    db/

    models/

    routes/

    services/

    app.ts

    server.ts

Funzionalità richieste

CRUD dipendenti (upsert tramite codice_fiscale)

Filtri corsi per macro_categoria e livello_specifico

Creazione attestato con:

stato iniziale = "In attesa"

calcolo automatico scadenza

salvataggio URL immagini (simulato)

Dashboard HR:

GET attestati filtrabili per stato

GET dettaglio attestato

PUT validazione attestato:

modifica tipo corso, data corso, ore dichiarate

approvazione

respingimento con note obbligatorie

simulazione invio email di esito

Simulazione email

Stampa su console:

CF dipendente

stato finale

motivazione rifiuto (se presente)

3. Frontend (React + HTML5/CSS)

Genera una SPA con due interfacce distinte:

INTERFACCIA 1 — Modulo Dipendente (Mobile‑First)

Funzionalità

Inserimento dati anagrafici:

codice_fiscale

cognome

nome

email

reparto

luogo_nascita

data_nascita

Selezione corso tramite procedura guidata:

Selezione macro_categoria

Radio button: Base / Specifico / Aggiornamento

Lista corsi filtrati

Input:

data_corso

ore_dichiarate

Upload immagini:

fronte attestato

retro attestato

anteprima immediata

Invio:

salva dipendente (upsert)

salva attestato con stato "In attesa"

calcolo automatico scadenza

Design

Layout a colonna

Pulsanti grandi

Input touch‑friendly

Anteprima immagini con URL.createObjectURL

INTERFACCIA 2 — Dashboard HR (Desktop)

Funzionalità

Lista attestati filtrabile per stato:

In attesa

Approvato

Respinto

Click su attestato → vista split‑screen:

Vista validazione

Sinistra (modificabile)

Dati dipendente (solo lettura)

Tipo corso (modificabile)

Data corso (modificabile)

Ore dichiarate (modificabili)

Destra

Visualizzatore immagini fronte/retro con:

zoom +

zoom –

contenimento proporzioni

Azioni

Approva

stato → "Approvato"

invio email simulata

Respingi

mostra textarea obbligatoria "Note di rifiuto"

stato → "Respinto"

invio email simulata

4. Design generale

Moderno, pulito, responsive

Palette neutra con accenti blu/verde/rosso

Componenti modulari:

DipendenteForm

UploadPreview

HRDashboard

AttestatoList

AttestatoDetail

ImageViewer

API client

5. Output richiesto da Lovable

Genera:

DB schema SQL completo

Backend Node/Express con servizi e routing

Frontend React con componenti modulari

Simulazione upload immagini

Simulazione email

Calcolo automatico scadenze

Interfaccia mobile + desktop  IL DATABASE VERRA SALVATO IN LOCALE QUINDI PRECEDERE SALVA E CARICA DB PREVEDERE LINK DI COLLEGAMENTO PER CELLULARE IN CUI IL SINGOLO LAVORATORE ALLEGA L'ATTESTATO E COMPILA I CAMPI COGNOME NOME CF DATA E LUOGO DI NASCITA

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://attestato-safeguard.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/05db6a78-3607-489b-976e-559b46a71703).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

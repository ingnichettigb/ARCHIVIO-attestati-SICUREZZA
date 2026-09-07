# Correzione: incarichi non visibili nella pagina Dipendenti

## Diagnosi (verificata)

- Codice e dati sono corretti: 128 dipendenti, 459 attestati collegati, 18 corsi; la logica degli incarichi esiste in `src/lib/api.ts` e la pagina la usa.
- Ma dal vivo ogni dipendente mostra "0 attestati". Causa: la tabella attestati ha **due** collegamenti verso i dipendenti (per id e per codice fiscale); la richiesta dati con `dipendenti(*)` è ambigua, il database la rifiuta e la pagina mostra elenchi vuoti senza errore visibile.
- Effetto collaterale: la stessa richiesta è usata anche da **Dashboard HR** e **Scadenze**, quindi anche lì corsi/nominativi possono risultare vuoti.
- Nota dati: per alcuni dipendenti la colonna "reparto" contiene una data (eredità dell'import Excel).

## Interventi

1. **Correggere il caricamento dati** in `src/lib/api.ts` (`getAttestati`): indicare esplicitamente il collegamento da usare (`dipendenti!attestati_caricati_dipendente_id_fkey(*)`), così attestati, corsi e nominativi tornano a caricarsi ovunque (Dipendenti, HR, Scadenze, home).
2. **Verifica dal vivo** con browser: la lista Dipendenti mostra i badge degli incarichi (Sicurezza Lavoratori, Preposto, Primo Soccorso, Antincendio, Defibrillatore) colorati per stato; cliccando un dipendente si vede il riquadro "Incarichi e formazione" con base/specifico/aggiornamento, date e scadenze.
3. **Pulizia reparto** (dato importato male): dove "reparto" contiene una data, svuotarla.

## Note tecniche

- Nessuna modifica al database: solo la query client e una pulizia dati.
- Dopo la correzione, gli stati visibili saranno: Valido (verde), In scadenza entro 90 gg (ambra), Scaduto (rosso), Non incaricato (grigio).

/*
 * File:      api.ts
 * Percorso:  src/lib/api.ts
 * Data:      14/10/2026
 * Modifica:  01
 *
 * Modifica 01:
 *  - Aggiunta la sezione "Integrazioni DVR" (debito formativo): tipo IntegrazioneDvr e funzioni
 *    getIntegrazioniDvr, getIntegrazioniDvrAperte, creaIntegrazioneDvr, chiudiIntegrazioneDvr.
 *    Richiede lo script SQL supabase/migrations/20261014180000_integrazioni_dvr.sql.
 *    (Se la tabella non esiste ancora, le letture restituiscono un elenco vuoto senza rompere le pagine.)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client senza tipi generati: serve per le tabelle nuove (reparti, categorie_corso)
 * finché il file types.ts non viene rigenerato da Lovable dopo la migrazione.
 */
const sb = supabase as unknown as SupabaseClient;

export type Dipendente = {
  id: string;
  codice_fiscale: string;
  cognome: string;
  nome: string;
  email: string | null;
  reparto: string | null;
  /** Sottoreparto scelto dentro il reparto (es. "Assistente amministrativo" per ATA). */
  sottoreparto: string | null;
  /** Solo per i reparti che la richiedono (es. Docente): es. "A-26". */
  classe_concorso: string | null;
  /** Materia insegnata, testo libero con suggerimenti. */
  materia: string | null;
  luogo_nascita: string | null;
  data_nascita: string | null;
  /** Codici ATECO letti dall'attestato (testo libero, anche più codici). */
  codice_ateco?: string | null;
};

export type TipoCorso = {
  id: string;
  nome_corso: string;
  macro_categoria: string;
  livello_specifico: string;
  ore_minime_legge: number | null;
  durata_validita_anni: number | null;
  /** Codice ufficiale del corso (es. FSL4, A+FSL6). Non è univoco da solo. */
  codice: string | null;
  /** Posizione nell'elenco, usata per il trascinamento nella tabella. */
  ordine: number;
  /** Ogni quanti anni va rifatto l'aggiornamento collegato. */
  anni_aggiornamento: number | null;
  /** Ore dell'aggiornamento collegato. */
  ore_aggiornamento: number | null;
  /** Codice del tipo di corso (in questa stessa tabella) da fare per rinnovare. */
  codice_corso_aggiornamento: string | null;
  /** Se falso, il lavoratore non vede questo corso specifico nel modulo di invio. */
  visibile_lavoratore: boolean;
};

export type Stato = "In attesa" | "Approvato" | "Respinto";

export type Attestato = {
  id: string;
  dipendente_id: string;
  codice_fiscale: string;
  tipo_corso_id: string;
  data_corso: string;
  data_scadenza_calcolata: string | null;
  ore_dichiarate: number | null;
  url_foto_fronte: string | null;
  url_foto_retro: string | null;
  stato_validazione: Stato;
  note_rifiuto: string | null;
  data_validazione: string | null;
  created_at: string;
  dipendenti?: Dipendente | null;
  tipi_corso?: TipoCorso | null;
};

export async function getTipiCorso(): Promise<TipoCorso[]> {
  const { data, error } = await sb
    .from("tipi_corso")
    .select("*")
    .order("ordine")
    .order("nome_corso");
  if (error) throw error;
  return (data ?? []) as TipoCorso[];
}

/** Solo i corsi che il lavoratore può scegliere nel modulo (rispetta anche il nascondimento per macro-categoria). */
export async function getTipiCorsoVisibili(): Promise<TipoCorso[]> {
  const [tutti, nascoste] = await Promise.all([getTipiCorso(), getCategorieNascoste()]);
  const nasc = new Set(nascoste);
  return tutti.filter((t) => t.visibile_lavoratore && !nasc.has(t.macro_categoria));
}

/* -------------------- Gestione avanzata dei tipi di corso -------------------- */

export async function aggiornaTipoCorso(
  id: string,
  patch: Partial<
    Pick<
      TipoCorso,
      | "codice"
      | "nome_corso"
      | "macro_categoria"
      | "livello_specifico"
      | "ore_minime_legge"
      | "durata_validita_anni"
      | "anni_aggiornamento"
      | "ore_aggiornamento"
      | "codice_corso_aggiornamento"
      | "visibile_lavoratore"
      | "ordine"
    >
  >,
) {
  const pulito = { ...patch };
  if (typeof pulito.nome_corso === "string") {
    pulito.nome_corso = pulito.nome_corso.trim();
    if (!pulito.nome_corso) throw new Error("Il nome del corso non può essere vuoto");
  }
  const { error } = await sb.from("tipi_corso").update(pulito).eq("id", id);
  if (error) throw error;
}

export async function aggiungiTipoCorso(input: {
  nome_corso: string;
  macro_categoria: string;
  livello_specifico: string;
  ordine: number;
}) {
  const nome = input.nome_corso.trim();
  if (!nome) throw new Error("Scrivi il nome del corso");
  const { error } = await sb.from("tipi_corso").insert({
    nome_corso: nome,
    macro_categoria: input.macro_categoria.trim() || "Altro",
    livello_specifico: input.livello_specifico.trim() || "Base",
    ordine: input.ordine,
  });
  if (error) throw error;
}

export async function eliminaTipoCorso(id: string) {
  const { error } = await sb.from("tipi_corso").delete().eq("id", id);
  if (error) {
    // vincolo di chiave esterna: ci sono attestati caricati che usano questo corso
    if (error.code === "23503") {
      throw new Error(
        "Non si può eliminare: ci sono attestati caricati con questo corso. Puoi nasconderlo invece di cancellarlo.",
      );
    }
    throw error;
  }
}

/** Riassegna l'ordine ai corsi secondo la sequenza data (dopo un trascinamento). */
export async function riordinaTipiCorso(idsInOrdine: string[]) {
  await Promise.all(
    idsInOrdine.map((id, i) =>
      sb
        .from("tipi_corso")
        .update({ ordine: i + 1 })
        .eq("id", id),
    ),
  );
}

/* ---------------- Reparti (Docente, ATA, Studente, …) ---------------- */

export type Reparto = {
  id: string;
  nome: string;
  ordine: number;
  attivo: boolean;
  /** Se vero, nel modulo il lavoratore deve indicare classe di concorso e materia. */
  richiede_classe_concorso: boolean;
};

export type Sottoreparto = {
  id: string;
  reparto_id: string;
  codice: string | null;
  nome: string;
  ordine: number;
  attivo: boolean;
};

/** Elenco completo dei reparti (attivi e non). Lancia errore se la tabella non esiste. */
export async function getReparti(): Promise<Reparto[]> {
  const { data, error } = await sb.from("reparti").select("*").order("ordine").order("nome");
  if (error) throw error;
  return (data ?? []) as Reparto[];
}

export async function aggiungiReparto(nome: string, ordine: number) {
  const pulito = nome.trim();
  if (!pulito) throw new Error("Scrivi il nome del reparto");
  const { error } = await sb.from("reparti").insert({ nome: pulito, ordine });
  if (error) {
    if (error.code === "23505") throw new Error(`"${pulito}" è già presente`);
    throw error;
  }
}

export async function impostaRepartoAttivo(id: string, attivo: boolean) {
  const { error } = await sb.from("reparti").update({ attivo }).eq("id", id);
  if (error) throw error;
}

export async function eliminaReparto(id: string) {
  const { error } = await sb.from("reparti").delete().eq("id", id);
  if (error) throw error;
}

/** Attiva/disattiva la richiesta di classe di concorso e materia per un reparto. */
export async function impostaRepartoClasseConcorso(id: string, richiede: boolean) {
  const { error } = await sb
    .from("reparti")
    .update({ richiede_classe_concorso: richiede })
    .eq("id", id);
  if (error) throw error;
}

/** Aggiornamento libero di un reparto (usato dalla tabella di modifica avanzata). */
export async function aggiornaReparto(
  id: string,
  patch: Partial<Pick<Reparto, "nome" | "ordine" | "attivo" | "richiede_classe_concorso">>,
) {
  const pulito = { ...patch };
  if (typeof pulito.nome === "string") {
    pulito.nome = pulito.nome.trim();
    if (!pulito.nome) throw new Error("Il nome non può essere vuoto");
  }
  const { error } = await sb.from("reparti").update(pulito).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error(`"${pulito.nome}" è già presente`);
    throw error;
  }
}

/* -------- Sottoreparti (es. ATA -> AA, AT, CS, DSGA) -------- */

/** Tutti i sottoreparti, di tutti i reparti. */
export async function getSottoreparti(): Promise<Sottoreparto[]> {
  const { data, error } = await sb.from("sottoreparti").select("*").order("ordine").order("nome");
  if (error) throw error;
  return (data ?? []) as Sottoreparto[];
}

export async function aggiungiSottoreparto(input: {
  reparto_id: string;
  nome: string;
  codice?: string | null;
  ordine: number;
}) {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Scrivi il nome del sottoreparto");
  const { error } = await sb.from("sottoreparti").insert({
    reparto_id: input.reparto_id,
    nome,
    codice: input.codice?.trim().toUpperCase() || null,
    ordine: input.ordine,
  });
  if (error) {
    if (error.code === "23505") throw new Error(`"${nome}" è già presente in questo reparto`);
    throw error;
  }
}

export async function impostaSottorepartoAttivo(id: string, attivo: boolean) {
  const { error } = await sb.from("sottoreparti").update({ attivo }).eq("id", id);
  if (error) throw error;
}

export async function eliminaSottoreparto(id: string) {
  const { error } = await sb.from("sottoreparti").delete().eq("id", id);
  if (error) throw error;
}

/** Etichetta leggibile: "AA — Assistente amministrativo". */
export function etichettaSottoreparto(s: Pick<Sottoreparto, "codice" | "nome">) {
  return s.codice ? `${s.codice} — ${s.nome}` : s.nome;
}

/* ---- Classi di concorso e materie: il database cresce a ogni invio ---- */

export type ClasseConcorso = {
  id: string;
  codice: string;
  denominazione: string | null;
  usi: number;
  da_lavoratore: boolean;
  attivo: boolean;
};

export type Materia = {
  id: string;
  nome: string;
  classe_concorso: string | null;
  usi: number;
  da_lavoratore: boolean;
  attivo: boolean;
};

export async function getClassiConcorso(): Promise<ClasseConcorso[]> {
  const { data, error } = await sb.from("classi_concorso").select("*").order("codice");
  if (error) throw error;
  return (data ?? []) as ClasseConcorso[];
}

export async function getMaterie(): Promise<Materia[]> {
  const { data, error } = await sb
    .from("materie")
    .select("*")
    .order("usi", { ascending: false })
    .order("nome");
  if (error) throw error;
  return (data ?? []) as Materia[];
}

export async function aggiungiClasseConcorso(codice: string, denominazione?: string | null) {
  const c = codice.trim().toUpperCase();
  if (!c) throw new Error("Scrivi il codice della classe di concorso");
  const { error } = await sb
    .from("classi_concorso")
    .insert({ codice: c, denominazione: denominazione?.trim() || null });
  if (error) {
    if (error.code === "23505") throw new Error(`"${c}" è già presente`);
    throw error;
  }
}

export async function impostaClasseAttiva(id: string, attivo: boolean) {
  const { error } = await sb.from("classi_concorso").update({ attivo }).eq("id", id);
  if (error) throw error;
}

export async function eliminaClasseConcorso(id: string) {
  const { error } = await sb.from("classi_concorso").delete().eq("id", id);
  if (error) throw error;
}

export async function eliminaMateria(id: string) {
  const { error } = await sb.from("materie").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Salva nel database quello che il lavoratore ha scritto, così la prossima
 * persona se lo ritrova già pronto fra i suggerimenti. Non blocca mai l'invio.
 */
export async function registraClasseEMateria(classe?: string | null, materia?: string | null) {
  const c = (classe ?? "").trim();
  const m = (materia ?? "").trim();
  try {
    if (c) await sb.rpc("registra_classe_concorso", { p_codice: c, p_denominazione: null });
    if (m) await sb.rpc("registra_materia", { p_nome: m, p_classe: c || null });
  } catch {
    /* il database dei suggerimenti non è critico: si ignora l'errore */
  }
}

/** Vero se il testo del reparto è leggibile (esclude vuoti e date importate male da Excel). */
export function repartoLeggibile(v: string | null | undefined): v is string {
  const t = (v ?? "").trim();
  return t.length > 0 && t.length <= 40 && !/^\d/.test(t);
}

/** Cambia il reparto di un dipendente già in archivio. */
export async function aggiornaRepartoDipendente(
  id: string,
  reparto: string | null,
  sottoreparto: string | null = null,
) {
  const { error } = await sb
    .from("dipendenti")
    .update({ reparto: reparto || null, sottoreparto: sottoreparto || null })
    .eq("id", id);
  if (error) throw error;
}

/** Aggiorna solo il sottoreparto (il reparto resta quello che è). */
export async function aggiornaSottorepartoDipendente(id: string, sottoreparto: string | null) {
  const { error } = await sb
    .from("dipendenti")
    .update({ sottoreparto: sottoreparto || null })
    .eq("id", id);
  if (error) throw error;
}

/** Aggiorna classe di concorso e materia di un docente già in archivio. */
export async function aggiornaInsegnamentoDipendente(
  id: string,
  classe_concorso: string | null,
  materia: string | null,
) {
  const { error } = await sb
    .from("dipendenti")
    .update({
      classe_concorso: classe_concorso?.trim().toUpperCase() || null,
      materia: materia?.trim() || null,
    })
    .eq("id", id);
  if (error) throw error;
  await registraClasseEMateria(classe_concorso, materia);
}

/* ------- Categorie di corso mostrate al lavoratore nel modulo ------- */

export type CategoriaCorso = {
  macro_categoria: string;
  visibile_lavoratore: boolean;
  corsi: number;
};

/**
 * Elenco unico delle categorie: ricavato da tipi_corso (quindi è lo stesso
 * elenco dei corsi per tutti) + la scelta di visibilità salvata in categorie_corso.
 * Una categoria senza riga in categorie_corso è considerata visibile.
 */
export async function getCategorieCorso(): Promise<CategoriaCorso[]> {
  const [corsi, vis] = await Promise.all([
    supabase.from("tipi_corso").select("macro_categoria"),
    sb.from("categorie_corso").select("macro_categoria, visibile_lavoratore"),
  ]);
  if (corsi.error) throw corsi.error;
  if (vis.error) throw vis.error;
  const stato = new Map<string, boolean>(
    (vis.data ?? []).map((r: { macro_categoria: string; visibile_lavoratore: boolean }) => [
      r.macro_categoria,
      r.visibile_lavoratore,
    ]),
  );
  const conteggio = new Map<string, number>();
  for (const c of corsi.data ?? []) {
    conteggio.set(c.macro_categoria, (conteggio.get(c.macro_categoria) ?? 0) + 1);
  }
  return Array.from(conteggio.keys())
    .sort((a, b) => a.localeCompare(b, "it"))
    .map((nome) => ({
      macro_categoria: nome,
      visibile_lavoratore: stato.get(nome) ?? true,
      corsi: conteggio.get(nome) ?? 0,
    }));
}

export async function impostaCategoriaVisibile(macro: string, visibile: boolean) {
  const { error } = await sb
    .from("categorie_corso")
    .upsert(
      { macro_categoria: macro, visibile_lavoratore: visibile },
      { onConflict: "macro_categoria" },
    );
  if (error) throw error;
}

/**
 * Nomi delle categorie NASCOSTE al lavoratore.
 * Se la tabella non esiste ancora (migrazione non eseguita) non nasconde nulla.
 */
export async function getCategorieNascoste(): Promise<string[]> {
  const { data, error } = await sb
    .from("categorie_corso")
    .select("macro_categoria")
    .eq("visibile_lavoratore", false);
  if (error) return [];
  return (data ?? []).map((r: { macro_categoria: string }) => r.macro_categoria);
}

export async function getAttestati(stato?: Stato | "Tutti"): Promise<Attestato[]> {
  let q = supabase
    .from("attestati_caricati")
    .select("*, dipendenti!attestati_caricati_dipendente_id_fkey(*), tipi_corso(*)")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (stato && stato !== "Tutti") q = q.eq("stato_validazione", stato);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Attestato[];
}

export async function getDipendenti(): Promise<Dipendente[]> {
  const { data, error } = await sb.from("dipendenti").select("*").order("cognome").limit(2000);
  if (error) throw error;
  return (data ?? []) as Dipendente[];
}

export async function upsertDipendente(d: Omit<Dipendente, "id">): Promise<Dipendente> {
  const payload = {
    ...d,
    codice_fiscale: d.codice_fiscale.trim().toUpperCase(),
    data_nascita: d.data_nascita || null,
    sottoreparto: d.sottoreparto?.trim() || null,
    classe_concorso: d.classe_concorso?.trim().toUpperCase() || null,
    materia: d.materia?.trim() || null,
  };
  const { data, error } = await sb
    .from("dipendenti")
    .upsert(payload, { onConflict: "codice_fiscale" })
    .select()
    .single();
  if (error) throw error;
  return data as Dipendente;
}

export async function uploadFoto(file: File, cf: string, lato: string) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${cf}/${Date.now()}-${lato}.${ext}`;
  const { error } = await supabase.storage.from("attestati").upload(path, file);
  if (error) throw error;
  return path;
}

export async function fotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from("attestati").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function creaAttestato(input: {
  dipendente_id: string;
  codice_fiscale: string;
  tipo_corso_id: string;
  data_corso: string;
  ore_dichiarate: number | null;
  url_foto_fronte: string | null;
  url_foto_retro: string | null;
}) {
  const { data, error } = await supabase
    .from("attestati_caricati")
    .insert({ ...input, stato_validazione: "In attesa" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

type AttestatoPatch = Partial<Omit<Attestato, "dipendenti" | "tipi_corso">>;

export async function aggiornaAttestato(id: string, patch: AttestatoPatch) {
  const { data, error } = await supabase
    .from("attestati_caricati")
    .update(patch)
    .eq("id", id)
    .select("*, dipendenti!attestati_caricati_dipendente_id_fkey(*), tipi_corso(*)")
    .single();
  if (error) throw error;
  return data as unknown as Attestato;
}

/**
 * Prepara il link mailto: con il messaggio di esito già scritto.
 * Non serve nessun servizio esterno: si apre l'app di posta di chi usa la dashboard.
 */
export function costruisciMailto(a: Attestato, esito: Stato): string | null {
  const email = a.dipendenti?.email?.trim();
  if (!email) return null;
  const corso = a.tipi_corso?.nome_corso ?? "corso di formazione";
  const nome = a.dipendenti?.nome ?? "";
  const dataCorso = formatData(a.data_corso);

  let oggetto: string;
  let righe: string[];
  if (esito === "Approvato") {
    oggetto = `Attestato approvato: ${corso}`;
    righe = [
      `Gentile ${nome},`,
      "",
      `il tuo attestato "${corso}" (corso del ${dataCorso}) è stato verificato e approvato.`,
      a.data_scadenza_calcolata
        ? `Scadenza: ${formatData(a.data_scadenza_calcolata)}.`
        : "Questo attestato non ha scadenza.",
      "",
      "Grazie per la collaborazione.",
    ];
  } else {
    oggetto = `Attestato respinto: ${corso}`;
    righe = [
      `Gentile ${nome},`,
      "",
      `il tuo attestato "${corso}" (corso del ${dataCorso}) non è stato accettato.`,
      "",
      `Motivo: ${a.note_rifiuto?.trim() || "non specificato"}`,
      "",
      "Puoi caricarlo di nuovo dal modulo, correggendo quanto indicato.",
      "",
      "Grazie per la collaborazione.",
    ];
  }
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    oggetto,
  )}&body=${encodeURIComponent(righe.join("\r\n"))}`;
}

/** Apre l'app di posta con l'email di esito. Restituisce false se manca l'indirizzo. */
export function apriEmailEsito(a: Attestato, esito: Stato): boolean {
  const link = costruisciMailto(a, esito);
  if (!link) return false;
  window.location.href = link;
  return true;
}

/** Esporta l'intero database in un file JSON salvato sul dispositivo. */
export async function esportaDb() {
  const [dip, tipi, att, rep, sot, cat, classi, mat] = await Promise.all([
    supabase.from("dipendenti").select("*").limit(5000),
    supabase.from("tipi_corso").select("*"),
    supabase.from("attestati_caricati").select("*").limit(20000),
    sb.from("reparti").select("*"),
    sb.from("sottoreparti").select("*"),
    sb.from("categorie_corso").select("*"),
    sb.from("classi_concorso").select("*"),
    sb.from("materie").select("*"),
  ]);
  const dump = {
    esportato_il: new Date().toISOString(),
    versione: 3,
    dipendenti: dip.data ?? [],
    tipi_corso: tipi.data ?? [],
    attestati_caricati: att.data ?? [],
    reparti: rep.data ?? [],
    sottoreparti: sot.data ?? [],
    categorie_corso: cat.data ?? [],
    classi_concorso: classi.data ?? [],
    materie: mat.data ?? [],
  };
  const blob = new Blob([JSON.stringify(dump, null, 2)], {
    type: "application/json",
  });
  const nome = `archivio-attestati-${new Date().toISOString().slice(0, 10)}.json`;

  const w = window as unknown as {
    showSaveFilePicker?: (o: unknown) => Promise<{
      createWritable: () => Promise<{
        write: (b: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: nome,
        types: [{ description: "Backup JSON", accept: { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return dump;
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return null;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
  return dump;
}

/** Ripristina un backup JSON nel database (unisce, non cancella). */
export async function importaDb(file: File) {
  const dump = JSON.parse(await file.text());
  let dipCount = 0;
  let attCount = 0;

  if (Array.isArray(dump.tipi_corso) && dump.tipi_corso.length) {
    await supabase.from("tipi_corso").upsert(dump.tipi_corso, { onConflict: "id" });
  }
  if (Array.isArray(dump.dipendenti)) {
    for (let i = 0; i < dump.dipendenti.length; i += 200) {
      const chunk = dump.dipendenti.slice(i, i + 200);
      const { error } = await supabase
        .from("dipendenti")
        .upsert(chunk, { onConflict: "codice_fiscale" });
      if (error) throw error;
      dipCount += chunk.length;
    }
  }
  // Reparti e categorie (ignorati se le tabelle non esistono ancora)
  if (Array.isArray(dump.reparti) && dump.reparti.length) {
    await sb.from("reparti").upsert(dump.reparti, { onConflict: "nome" });
  }
  if (Array.isArray(dump.sottoreparti) && dump.sottoreparti.length) {
    await sb.from("sottoreparti").upsert(dump.sottoreparti, { onConflict: "id" });
  }
  if (Array.isArray(dump.classi_concorso) && dump.classi_concorso.length) {
    await sb.from("classi_concorso").upsert(dump.classi_concorso, { onConflict: "codice" });
  }
  if (Array.isArray(dump.materie) && dump.materie.length) {
    await sb.from("materie").upsert(dump.materie, { onConflict: "id" });
  }
  if (Array.isArray(dump.categorie_corso) && dump.categorie_corso.length) {
    await sb
      .from("categorie_corso")
      .upsert(dump.categorie_corso, { onConflict: "macro_categoria" });
  }
  if (Array.isArray(dump.attestati_caricati)) {
    for (let i = 0; i < dump.attestati_caricati.length; i += 200) {
      const chunk = dump.attestati_caricati.slice(i, i + 200);
      const { error } = await supabase
        .from("attestati_caricati")
        .upsert(chunk, { onConflict: "id" });
      if (error) throw error;
      attCount += chunk.length;
    }
  }
  return { dipCount, attCount };
}

export function statoBadgeClass(stato: string) {
  if (stato === "Approvato") return "bg-success/12 text-success border-success/30";
  if (stato === "Respinto") return "bg-destructive/12 text-destructive border-destructive/30";
  return "bg-warning/15 text-warning-foreground border-warning/35";
}

export function formatData(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

export function scaduto(d: string | null | undefined) {
  if (!d) return false;
  return new Date(d) < new Date();
}

/* ---------------- Incarichi ---------------- */

export type LivelloKey = "Base" | "Specifico" | "Aggiornamento";

export type Incarico = {
  key: string;
  label: string;
  categoria: string;
  livelli: LivelloKey[];
};

export const INCARICHI: Incarico[] = [
  {
    key: "lavoratore",
    label: "Sicurezza Lavoratori",
    categoria: "Sicurezza Lavoratori",
    livelli: ["Base", "Specifico", "Aggiornamento"],
  },
  {
    key: "preposto",
    label: "Preposto",
    categoria: "Preposto",
    livelli: ["Specifico", "Aggiornamento"],
  },
  {
    key: "primo-soccorso",
    label: "Primo Soccorso",
    categoria: "Primo Soccorso",
    livelli: ["Base", "Aggiornamento"],
  },
  {
    key: "antincendio",
    label: "Antincendio",
    categoria: "Antincendio",
    livelli: ["Base", "Aggiornamento"],
  },
  {
    key: "defibrillatore",
    label: "Defibrillatore (BLSD)",
    categoria: "Defibrillatore",
    livelli: ["Base", "Aggiornamento"],
  },
];

export type StatoScadenza = "valido" | "in-scadenza" | "scaduto" | "mancante";

export type VoceIncarico = {
  livello: LivelloKey;
  attestato: Attestato | null;
  stato: StatoScadenza;
};

export type RiepilogoIncarico = {
  incarico: Incarico;
  voci: VoceIncarico[];
  ricoperto: boolean;
  peggiore: StatoScadenza;
};

export function statoScadenza(d: string | null | undefined): StatoScadenza {
  if (!d) return "valido";
  const oggi = new Date();
  const scad = new Date(d);
  const giorni = Math.floor((scad.getTime() - oggi.getTime()) / 86400000);
  if (giorni < 0) return "scaduto";
  if (giorni <= 90) return "in-scadenza";
  return "valido";
}

export function scadenzaBadgeClass(s: StatoScadenza) {
  if (s === "scaduto") return "bg-destructive/12 text-destructive border-destructive/30";
  if (s === "in-scadenza") return "bg-warning/15 text-warning-foreground border-warning/35";
  if (s === "valido") return "bg-success/12 text-success border-success/30";
  return "bg-muted text-muted-foreground border-border";
}

export function etichettaStato(s: StatoScadenza) {
  if (s === "scaduto") return "Scaduto";
  if (s === "in-scadenza") return "In scadenza";
  if (s === "valido") return "Valido";
  return "Mancante";
}

const ORDINE: StatoScadenza[] = ["scaduto", "in-scadenza", "mancante", "valido"];

export function riepilogoIncarichi(attestati: Attestato[]): RiepilogoIncarico[] {
  return INCARICHI.map((incarico) => {
    const voci: VoceIncarico[] = incarico.livelli.map((livello) => {
      const candidati = attestati
        .filter(
          (a) =>
            a.tipi_corso?.macro_categoria === incarico.categoria &&
            a.tipi_corso?.livello_specifico === livello,
        )
        .sort((a, b) => (a.data_corso < b.data_corso ? 1 : -1));
      const attestato = candidati[0] ?? null;
      return {
        livello,
        attestato,
        stato: attestato ? statoScadenza(attestato.data_scadenza_calcolata) : "mancante",
      };
    });
    const ricoperto = voci.some((v) => v.attestato);
    const peggiore = ricoperto
      ? (ORDINE.find((s) => voci.some((v) => v.attestato && v.stato === s)) ?? "valido")
      : "mancante";
    return { incarico, voci, ricoperto, peggiore };
  });
}

/* ---------------- Documenti PDF attestati ---------------- */

export const CARTELLA_ARCHIVIO = "Archivio Attestati Sicurezza";

export const TIPI_ATTESTATO_PDF = [
  "Sicurezza Lavoratori",
  "Preposto",
  "Primo Soccorso",
  "Antincendio",
  "Defibrillatore",
  "Altro",
] as const;

export type DocumentoAttestato = {
  id: string;
  dipendente_id: string;
  codice_fiscale: string;
  tipo_attestato: string;
  tipo_personalizzato: string | null;
  data_scadenza: string;
  nome_file: string;
  percorso_file: string;
  created_at: string;
};

/** Normalizza un testo: maiuscolo, senza accenti, spazi -> underscore. */
export function normalizzaNome(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Codice fiscale pulito: solo lettere e numeri, maiuscolo. */
export function pulisciCF(s: string) {
  return (s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
const pulisciCodiceFiscale = pulisciCF;

/**
 * Nome file standard per l'archivio:
 * AAAA-MM_COGNOME_NOME_CF_TIPO.pdf
 * dove AAAA-MM è l'anno/mese di emanazione (rilascio) dell'attestato.
 */
export function nomeFilePdf(
  cognome: string,
  nome: string,
  tipo: string,
  dataEmanazione: string,
  codiceFiscale?: string,
) {
  const data = (dataEmanazione || "").trim();
  const annoMese = data.length >= 7 ? data.slice(0, 7) : "ANNO-MANCANTE";
  const cf = codiceFiscale ? `_${pulisciCodiceFiscale(codiceFiscale)}` : "";
  return `${annoMese}_${normalizzaNome(cognome)}_${normalizzaNome(nome)}${cf}_${normalizzaNome(tipo)}.pdf`;
}

export function cartellaDipendente(d: Dipendente) {
  return `${normalizzaNome(d.cognome)}_${normalizzaNome(d.nome)}_${d.codice_fiscale.toUpperCase()}`;
}

export async function getDocumenti(dipendenteId: string): Promise<DocumentoAttestato[]> {
  const { data, error } = await supabase
    .from("documenti_attestati")
    .select("*")
    .eq("dipendente_id", dipendenteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DocumentoAttestato[];
}

export async function caricaDocumento(input: {
  dipendente: Dipendente;
  tipo: string;
  tipoPersonalizzato?: string | null;
  dataCorso: string; // Data di emanazione / rilascio dell'attestato
  dataScadenza: string; // Data di scadenza per il registro
  file: File;
}) {
  const etichetta =
    input.tipo === "Altro" && input.tipoPersonalizzato ? input.tipoPersonalizzato : input.tipo;
  const nome = nomeFilePdf(
    input.dipendente.cognome,
    input.dipendente.nome,
    etichetta,
    input.dataCorso,
    input.dipendente.codice_fiscale,
  );
  const percorso = `${CARTELLA_ARCHIVIO}/${cartellaDipendente(input.dipendente)}/${nome}`;

  const { error: upErr } = await supabase.storage
    .from("attestati")
    .upload(percorso, input.file, { upsert: true, contentType: "application/pdf" });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("documenti_attestati")
    .insert({
      dipendente_id: input.dipendente.id,
      codice_fiscale: input.dipendente.codice_fiscale,
      tipo_attestato: input.tipo,
      tipo_personalizzato: input.tipo === "Altro" ? (input.tipoPersonalizzato ?? null) : null,
      data_scadenza: input.dataScadenza,
      nome_file: nome,
      percorso_file: percorso,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DocumentoAttestato;
}

export async function eliminaDocumento(doc: DocumentoAttestato) {
  await supabase.storage.from("attestati").remove([doc.percorso_file]);
  const { error } = await supabase.from("documenti_attestati").delete().eq("id", doc.id);
  if (error) throw error;
}

export async function urlDocumento(percorso: string) {
  const { data, error } = await supabase.storage
    .from("attestati")
    .createSignedUrl(percorso, 60 * 60);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

/* --- Copia locale tramite File System Access API --- */

type DirHandle = {
  getDirectoryHandle: (n: string, o?: { create?: boolean }) => Promise<DirHandle>;
  getFileHandle: (
    n: string,
    o?: { create?: boolean },
  ) => Promise<{
    createWritable: () => Promise<{
      write: (b: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

let cartellaLocale: DirHandle | null = null;

export function supportaCartellaLocale() {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function scegliCartellaLocale(): Promise<DirHandle | null> {
  if (cartellaLocale) return cartellaLocale;
  const w = window as unknown as {
    showDirectoryPicker?: (o?: unknown) => Promise<DirHandle>;
  };
  if (!w.showDirectoryPicker) return null;
  const scelta = await w.showDirectoryPicker({
    id: "archivio-attestati",
    mode: "readwrite",
    startIn: "documents",
  });
  // Se l'utente sceglie la cartella Documenti, usa/crea la sottocartella dedicata.
  const nomeScelta = (scelta as unknown as { name?: string }).name ?? "";
  cartellaLocale =
    nomeScelta === CARTELLA_ARCHIVIO
      ? scelta
      : await scelta.getDirectoryHandle(CARTELLA_ARCHIVIO, { create: true });
  return cartellaLocale;
}

/** Scrive il PDF nella cartella locale; chiede conferma se il file esiste già. */
export async function salvaInLocale(file: File, nomeFile: string, sottocartella: string) {
  const root = await scegliCartellaLocale();
  if (!root) throw new Error("Cartella non disponibile");
  const dir = await root.getDirectoryHandle(sottocartella, { create: true });
  let esiste = false;
  try {
    await dir.getFileHandle(nomeFile);
    esiste = true;
  } catch {
    esiste = false;
  }
  if (esiste && !window.confirm(`"${nomeFile}" esiste già nella cartella locale. Sovrascrivere?`))
    return false;
  const handle = await dir.getFileHandle(nomeFile, { create: true });
  const w = await handle.createWritable();
  await w.write(file);
  await w.close();
  return true;
}

/* ---------------- Integrazioni DVR (debito formativo) ---------------- */

export type StatoIntegrazione = "Da completare" | "Completata";

export type IntegrazioneDvr = {
  id: string;
  dipendente_id: string;
  attestato_origine_id: string | null;
  tipo_corso_nome: string | null;
  /** Etichetta scelta dall'operatore, es. "Integrazione 4 ore". */
  descrizione: string;
  ore: number | null;
  argomenti_mancanti: string[];
  stato: StatoIntegrazione;
  data_richiesta: string;
  attestato_chiusura_id: string | null;
  data_chiusura: string | null;
  created_at: string;
};

/** Tutte le integrazioni (aperte e chiuse). Se la tabella non esiste ancora: elenco vuoto. */
export async function getIntegrazioniDvr(): Promise<IntegrazioneDvr[]> {
  const { data, error } = await sb
    .from("integrazioni_dvr")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("integrazioni_dvr non disponibile:", error.message);
    return [];
  }
  return (data ?? []) as IntegrazioneDvr[];
}

/** Integrazioni ancora "Da completare" di un lavoratore. */
export async function getIntegrazioniDvrAperte(dipendenteId: string): Promise<IntegrazioneDvr[]> {
  const { data, error } = await sb
    .from("integrazioni_dvr")
    .select("*")
    .eq("dipendente_id", dipendenteId)
    .eq("stato", "Da completare")
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as IntegrazioneDvr[];
}

export async function creaIntegrazioneDvr(input: {
  dipendente_id: string;
  attestato_origine_id: string | null;
  tipo_corso_nome: string | null;
  descrizione: string;
  ore: number | null;
  argomenti_mancanti: string[];
}): Promise<IntegrazioneDvr> {
  const { data, error } = await sb
    .from("integrazioni_dvr")
    .insert({ ...input, stato: "Da completare" })
    .select()
    .single();
  if (error) throw error;
  return data as IntegrazioneDvr;
}

/** Segna l'integrazione come completata, collegando (se c'è) l'attestato che la chiude. */
export async function chiudiIntegrazioneDvr(id: string, attestatoChiusuraId: string | null) {
  const { error } = await sb
    .from("integrazioni_dvr")
    .update({
      stato: "Completata",
      attestato_chiusura_id: attestatoChiusuraId,
      data_chiusura: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

/* ---------------- Ruoli di sicurezza (Preposto, Antincendio, ...) ---------------- */

export type RuoloSicurezza = {
  id: string;
  nome: string;
  descrizione: string | null;
  macro_categoria: string | null;
  obbligatorio_tutti: boolean;
  attivo: boolean;
  ordine: number;
};

export type AssegnazioneRuolo = { id: string; dipendente_id: string; ruolo_id: string };

export async function getRuoliSicurezza(): Promise<RuoloSicurezza[]> {
  const { data, error } = await sb.from("ruoli_sicurezza").select("*").order("ordine").order("nome");
  if (error) throw error;
  return (data ?? []) as RuoloSicurezza[];
}

export async function aggiungiRuolo(input: {
  nome: string;
  macro_categoria?: string | null;
  obbligatorio_tutti?: boolean;
  ordine: number;
}) {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Scrivi il nome del ruolo");
  const { error } = await sb.from("ruoli_sicurezza").insert({
    nome,
    macro_categoria: input.macro_categoria?.trim() || null,
    obbligatorio_tutti: input.obbligatorio_tutti ?? false,
    ordine: input.ordine,
  });
  if (error) {
    if (error.code === "23505") throw new Error(`"${nome}" è già presente`);
    throw error;
  }
}

export async function aggiornaRuolo(
  id: string,
  patch: Partial<Pick<RuoloSicurezza, "nome" | "macro_categoria" | "obbligatorio_tutti" | "attivo">>,
) {
  const { error } = await sb.from("ruoli_sicurezza").update(patch).eq("id", id);
  if (error) throw error;
}

export async function eliminaRuolo(id: string) {
  const { error } = await sb.from("ruoli_sicurezza").delete().eq("id", id);
  if (error) throw error;
}

export async function getAssegnazioniRuoli(): Promise<AssegnazioneRuolo[]> {
  const { data, error } = await sb.from("dipendenti_ruoli").select("id, dipendente_id, ruolo_id").limit(10000);
  if (error) throw error;
  return (data ?? []) as AssegnazioneRuolo[];
}

/** Assegna (true) o toglie (false) un ruolo a un dipendente. */
export async function impostaRuoloDipendente(dipendente_id: string, ruolo_id: string, assegnato: boolean) {
  if (assegnato) {
    const { error } = await sb
      .from("dipendenti_ruoli")
      .upsert({ dipendente_id, ruolo_id }, { onConflict: "dipendente_id,ruolo_id" });
    if (error) throw error;
  } else {
    const { error } = await sb
      .from("dipendenti_ruoli")
      .delete()
      .eq("dipendente_id", dipendente_id)
      .eq("ruolo_id", ruolo_id);
    if (error) throw error;
  }
}

/** Ruoli effettivi del dipendente: quelli spuntati + quelli obbligatori per tutti. */
export function ruoliDelDipendente(
  dipendenteId: string,
  ruoli: RuoloSicurezza[],
  assegnazioni: AssegnazioneRuolo[],
): RuoloSicurezza[] {
  const ids = new Set(assegnazioni.filter((a) => a.dipendente_id === dipendenteId).map((a) => a.ruolo_id));
  return ruoli.filter((r) => r.attivo && (r.obbligatorio_tutti || ids.has(r.id)));
}

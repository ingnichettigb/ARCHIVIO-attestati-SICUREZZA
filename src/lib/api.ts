import { supabase } from "@/integrations/supabase/client";

export type Dipendente = {
  id: string;
  codice_fiscale: string;
  cognome: string;
  nome: string;
  email: string | null;
  reparto: string | null;
  luogo_nascita: string | null;
  data_nascita: string | null;
};

export type TipoCorso = {
  id: string;
  nome_corso: string;
  macro_categoria: string;
  livello_specifico: string;
  ore_minime_legge: number | null;
  durata_validita_anni: number | null;
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
  const { data, error } = await supabase
    .from("tipi_corso")
    .select("*")
    .order("macro_categoria")
    .order("nome_corso");
  if (error) throw error;
  return (data ?? []) as TipoCorso[];
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
  const { data, error } = await supabase
    .from("dipendenti")
    .select("*")
    .order("cognome")
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as Dipendente[];
}

export async function upsertDipendente(
  d: Omit<Dipendente, "id">,
): Promise<Dipendente> {
  const payload = {
    ...d,
    codice_fiscale: d.codice_fiscale.trim().toUpperCase(),
    data_nascita: d.data_nascita || null,
  };
  const { data, error } = await supabase
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
  const { data } = await supabase.storage
    .from("attestati")
    .createSignedUrl(path, 60 * 60);
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

/** Simulazione invio email di esito (stampa su console). */
export function simulaEmail(a: Attestato, esito: Stato) {
  console.log(
    [
      "───────── EMAIL SIMULATA ─────────",
      `A: ${a.dipendenti?.email ?? "(email non presente)"}`,
      `Codice fiscale: ${a.codice_fiscale}`,
      `Corso: ${a.tipi_corso?.nome_corso ?? a.tipo_corso_id}`,
      `Esito: ${esito}`,
      esito === "Respinto" ? `Motivazione: ${a.note_rifiuto ?? ""}` : "",
      "──────────────────────────────────",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

/** Esporta l'intero database in un file JSON salvato sul dispositivo. */
export async function esportaDb() {
  const [dip, tipi, att] = await Promise.all([
    supabase.from("dipendenti").select("*").limit(5000),
    supabase.from("tipi_corso").select("*"),
    supabase.from("attestati_caricati").select("*").limit(20000),
  ]);
  const dump = {
    esportato_il: new Date().toISOString(),
    versione: 1,
    dipendenti: dip.data ?? [],
    tipi_corso: tipi.data ?? [],
    attestati_caricati: att.data ?? [],
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
        types: [
          { description: "Backup JSON", accept: { "application/json": [".json"] } },
        ],
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
  if (stato === "Respinto")
    return "bg-destructive/12 text-destructive border-destructive/30";
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

export function nomeFilePdf(
  cognome: string,
  nome: string,
  tipo: string,
  dataScadenza: string,
) {
  const data = dataScadenza.slice(0, 10).replace(/-/g, "");
  return `${normalizzaNome(cognome)}_${normalizzaNome(nome)}_${normalizzaNome(tipo)}_${data}.pdf`;
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
  dataScadenza: string;
  file: File;
}) {
  const etichetta =
    input.tipo === "Altro" && input.tipoPersonalizzato
      ? input.tipoPersonalizzato
      : input.tipo;
  const nome = nomeFilePdf(
    input.dipendente.cognome,
    input.dipendente.nome,
    etichetta,
    input.dataScadenza,
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
  const { error } = await supabase
    .from("documenti_attestati")
    .delete()
    .eq("id", doc.id);
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
export async function salvaInLocale(
  file: File,
  nomeFile: string,
  sottocartella: string,
) {
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

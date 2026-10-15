/*
 * File:      operatore.tsx
 * Percorso:  src/routes/operatore.tsx
 * Data:      14/10/2026
 * Modifica:  08
 *
 * Modifica 08:
 *  - Bozza email: oltre al testo semplice contiene una versione formattata (HTML) in cui l'integrazione
 *    richiesta e gli argomenti da integrare sono in grassetto; nel programma di posta si può modificare
 *    e formattare liberamente. Richiede src/lib/email-eml.ts (modifica 02).
 *
 * Modifica 07:
 *  - Archiviazione con esito "Valido con integrazione DVR": oltre all'attestato viene creata la voce
 *    "Da completare" (ore, argomenti mancanti) nella tabella integrazioni_dvr, visibile nella scheda lavoratore.
 *  - Archiviando un attestato "Valido" / "Valido con note" per un lavoratore con integrazioni da completare,
 *    compare un avviso: si può chiudere l'integrazione collegandola a quell'attestato.
 *  - Richiede src/lib/api.ts (modifica 01) e lo script SQL 20261014180000_integrazioni_dvr.sql.
 *
 * Modifica 06:
 *  - Sezione "1. Dati del lavoratore": il campo Email è sostituito dal campo "Codice ATECO"
 *    (già letto in automatico e salvato). L'email non si digita più, ma se il dipendente è già
 *    in archivio viene recuperata e usata come destinatario della bozza email di esito.
 *
 * Modifica 05:
 *  - Corretto l'errore "value too long for type character varying(16)": il codice fiscale
 *    letto dal documento poteva contenere spazi (es. "FFT GPP90L57G273Y" = 17 caratteri) mentre
 *    nel database è lungo al massimo 16. Ora viene ripulito (solo lettere e numeri, maiuscolo)
 *    alla lettura, alla digitazione, nel nome file, al salvataggio in coda e all'archiviazione:
 *    funziona anche per le righe già presenti in coda.
 *
 * Modifica 04:
 *  - Anteprima: l'icona "Ruota di 90°" è ora un pulsante piccolo in alto a destra SOPRA il
 *    documento (copre le icone poco usate della barra del PDF, a destra dello zoom).
 *    Il PDF si apre adattato alla larghezza del riquadro (zoom ridotto, pagina intera visibile).
 *
 * Modifica 03:
 *  - Sezione "3. Valutazione": nuovo esito "Valido con note". Si sceglie la nota da un elenco:
 *    la prima (predefinita) è già nel codice, le altre si aggiungono e vengono ricordate nella
 *    tabella Supabase note_valutazione (vedi supabase/migrations/20261014120000_note_valutazione.sql).
 *
 * Modifica 02:
 *  - Anteprima documento: aggiunta l'icona "Ruota di 90°" (PDF e foto) accanto a "Altro documento".
 *    Ogni clic ruota ancora di 90° in senso orario; la rotazione vale per la lettura nell'anteprima.
 *    Logica in src/lib/ruota-documento.ts.
 *
 * Modifica 01:
 *  - Icona email: la bozza ora contiene in allegato il file dell'attestato rinominato
 *    (AAAA-MM_COGNOME_NOME_CF_TIPOCORSO.ext), tramite file .eml (vedi src/lib/email-eml.ts).
 *  - Icona cartella: a ogni clic si apre "Salva con nome" col nome già rinominato,
 *    per scegliere la cartella di destinazione (rimosso il selettore di cartella ricordato).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, CopyPlus, DatabaseZap, FolderDown, Mail, Plus, Sparkles, Trash2, Upload, Loader2, Pencil, RotateCw,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getTipiCorso, upsertDipendente, normalizzaNome, CARTELLA_ARCHIVIO, cartellaDipendente, formatData,
  creaIntegrazioneDvr, getIntegrazioniDvrAperte, chiudiIntegrazioneDvr,
  type TipoCorso,
} from "@/lib/api";
import { estraiAttestato } from "@/lib/estrazione.functions";
import { getActiveProvider, useAiConfig } from "@/lib/ai-providers";
import { ImpostaAiButton } from "@/components/ImpostaAiDialog";
import { contaPagine, estraiPagine, parsePagine, piuSimile, somiglianza } from "@/lib/pdf-pagine";
import { ruotaDocumento } from "@/lib/ruota-documento";
import { costruisciEml, salvaFileConNome, scaricaBlob, type AllegatoEml } from "@/lib/email-eml";

const sb = supabase as unknown as SupabaseClient;

export const Route = createFileRoute("/operatore")({
  head: () => ({
    meta: [
      { title: "Postazione Operatore — Verifica attestati" },
      { name: "description", content: "Lettura automatica degli attestati, verifica affiancata, valutazione con integrazione DVR e coda per email cumulativa." },
      { property: "og:title", content: "Postazione Operatore — Verifica attestati" },
      { property: "og:description", content: "Carica un attestato, controlla i dati letti in automatico e prepara l'esito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Operatore,
});

type Esito = "Valido" | "Valido con note" | "Valido con integrazione DVR" | "Non valido";
const ESITI: Esito[] = ["Valido", "Valido con note", "Valido con integrazione DVR", "Non valido"];

/** Prima nota dell'elenco "Valido con note": sempre presente e proposta di default. */
const NOTA_PREDEFINITA = "L'attestato è parziale rispetto alle esigenze aziendali, sarà necessario integrare con la seconda parte della formazione specifica e relativo test.";
type NotaVal = { id: string; testo: string; predefinita: boolean };

type Riga = {
  id: string;
  cognome: string; nome: string; codice_fiscale: string; email: string; luogo_nascita: string;
  data_nascita: string; reparto: string; codice_ateco: string;
  tipo_corso_id: string | null; tipo_corso_nome: string; data_corso: string; ore: number | null; ente: string;
  argomenti: string[]; esito: Esito; integrazione: string; argomenti_mancanti: string[]; note: string;
  percorso_file: string | null; mime_file: string | null; nome_file: string | null;
  archiviato: boolean; inviato: boolean; created_at?: string;
};

const VUOTA: Omit<Riga, "id"> = {
  cognome: "", nome: "", codice_fiscale: "", email: "", luogo_nascita: "", data_nascita: "", reparto: "", codice_ateco: "",
  tipo_corso_id: null, tipo_corso_nome: "", data_corso: "", ore: null, ente: "", argomenti: [],
  esito: "Valido", integrazione: "", argomenti_mancanti: [], note: "",
  percorso_file: null, mime_file: null, nome_file: null, archiviato: false, inviato: false,
};

/** Codice fiscale pulito: solo lettere e numeri, maiuscolo (toglie anche gli spazi in mezzo). Nel DB il campo è max 16 caratteri. */
export function pulisciCF(s: string) {
  return (s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/**
 * Denominazione standard con anno e mese di emanazione del documento:
 * AAAA-MM_COGNOME_NOME_CF_TIPOCORSO.ext
 * Il prefisso deriva sempre da data_corso (data stampata sull'attestato), mai dalla data odierna.
 */
export function nomeFileStandard(r: Pick<Riga, "data_corso" | "cognome" | "nome" | "codice_fiscale" | "tipo_corso_nome">, ext = "pdf") {
  const dataDoc = (r.data_corso || "").trim();
  const am = dataDoc.length >= 7 ? dataDoc.slice(0, 7) : "ANNO-MANCANTE";
  return `${am}_${normalizzaNome(r.cognome)}_${normalizzaNome(r.nome)}_${pulisciCF(r.codice_fiscale)}_${normalizzaNome(r.tipo_corso_nome)}.${ext}`;
}
const estensione = (mime: string | null) => (mime === "application/pdf" ? "pdf" : mime?.split("/")[1]?.replace("jpeg", "jpg") || "jpg");

function pulisci(r: Partial<Riga>) {
  const { id: _i, created_at: _c, ...resto } = r as Riga;
  return { ...resto, data_nascita: resto.data_nascita || null, data_corso: resto.data_corso || null };
}

function riepilogo(r: Riga) {
  let s = `${r.cognome} ${r.nome} (${pulisciCF(r.codice_fiscale)})\nCorso: ${r.tipo_corso_nome} — ${formatData(r.data_corso)} — ${r.ore ?? "?"} ore\nEsito: ${r.esito}`;
  if (r.esito === "Valido con integrazione DVR") s += `\nIntegrazione richiesta: ${r.integrazione}${r.argomenti_mancanti.length ? `\nArgomenti da integrare: ${r.argomenti_mancanti.join(", ")}` : ""}`;
  if (r.note) s += `\nNote: ${r.note}`;
  return s;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Riepilogo in HTML per l'email: integrazione richiesta e argomenti da integrare in grassetto. */
function riepilogoHtml(r: Riga) {
  let h = `<b>${esc(`${r.cognome} ${r.nome}`)}</b> (${esc(pulisciCF(r.codice_fiscale))})<br>Corso: ${esc(r.tipo_corso_nome)} — ${esc(formatData(r.data_corso))} — ${r.ore ?? "?"} ore<br>Esito: <b>${esc(r.esito)}</b>`;
  if (r.esito === "Valido con integrazione DVR") {
    h += `<br><b>Integrazione richiesta: ${esc(r.integrazione)}</b>`;
    if (r.argomenti_mancanti.length) h += `<br><b>Argomenti da integrare: ${esc(r.argomenti_mancanti.join(", "))}</b>`;
  }
  if (r.note) h += `<br>Note: ${esc(r.note)}`;
  return h;
}

const fileToBase64 = (f: Blob) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1] ?? "");
    fr.onerror = rej;
    fr.readAsDataURL(f);
  });

function Operatore() {
  const qc = useQueryClient();
  const [aiConfig] = useAiConfig();
  const aiAttiva = getActiveProvider(aiConfig);
  const { data: tipi = [] } = useQuery({ queryKey: ["tipi-corso"], queryFn: getTipiCorso });
  const { data: argomenti = [] } = useQuery({
    queryKey: ["argomenti"],
    queryFn: async () => ((await sb.from("argomenti_corso").select("nome").order("nome")).data ?? []).map((x: { nome: string }) => x.nome),
  });
  const { data: integrazioni = [] } = useQuery({
    queryKey: ["integrazioni"],
    queryFn: async () => ((await sb.from("opzioni_integrazione").select("etichetta").order("ore")).data ?? []).map((x: { etichetta: string }) => x.etichetta),
  });
  const { data: coda = [] } = useQuery({
    queryKey: ["coda"],
    queryFn: async () => {
      const { data, error } = await sb.from("coda_valutazioni").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: Riga) => ({ ...VUOTA, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v ?? (VUOTA as Record<string, unknown>)[k]])) })) as Riga[];
    },
  });
  const { data: noteSalvate = [] } = useQuery({
    queryKey: ["note-valutazione"],
    queryFn: async () => {
      const { data, error } = await sb.from("note_valutazione").select("id,testo").order("created_at");
      if (error) return []; // tabella non ancora creata: resta solo la nota predefinita
      return (data ?? []).map((x: { id: string; testo: string }) => ({ id: x.id, testo: x.testo, predefinita: false })) as NotaVal[];
    },
  });
  const noteElenco = useMemo<NotaVal[]>(
    () => [{ id: "predefinita", testo: NOTA_PREDEFINITA, predefinita: true }, ...noteSalvate.filter((n) => n.testo !== NOTA_PREDEFINITA)],
    [noteSalvate],
  );
  const ricarica = () => qc.invalidateQueries({ queryKey: ["coda"] });

  const [form, setForm] = useState<Omit<Riga, "id">>(VUOTA);
  const [idInModifica, setIdInModifica] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [anteprima, setAnteprima] = useState<string | null>(null);
  const [anteprimaMime, setAnteprimaMime] = useState<string | null>(null);
  const [lettura, setLettura] = useState(false);
  const [selezionati, setSelezionati] = useState<Set<string>>(new Set());
  const [totPagine, setTotPagine] = useState(0);
  const [pagine, setPagine] = useState("");
  const [testoLetto, setTestoLetto] = useState("");
  const [suggerito, setSuggerito] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [rotazione, setRotazione] = useState(0);
  const [ruotando, setRuotando] = useState(false);
  const sorgenteRef = useRef<Blob | null>(null);
  const classifica = useMemo(
    () => testoLetto ? [...tipi].map((t) => ({ t, s: somiglianza(testoLetto, t.nome_corso) })).sort((a, b) => b.s - a.s) : tipi.map((t) => ({ t, s: 0 })),
    [tipi, testoLetto],
  );

  const set = <K extends keyof Riga>(k: K, v: Riga[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => () => { if (anteprima?.startsWith("blob:")) URL.revokeObjectURL(anteprima); }, [anteprima]);

  async function scegliFile(f: File) {
    if (!(f.type === "application/pdf" || f.type.startsWith("image/"))) return void toast.error("Carica un PDF o una foto");
    setFile(f);
    setAnteprima(URL.createObjectURL(f));
    setAnteprimaMime(f.type);
    sorgenteRef.current = f; setRotazione(0);
    setIdInModifica(null);
    setForm(VUOTA);
    setPagine(""); setTestoLetto(""); setSuggerito(null);
    setTotPagine(f.type === "application/pdf" ? await contaPagine(f).catch(() => 0) : 0);
    setLettura(true);
    try {
      const r = await estraiAttestato({
        data: {
          base64: await fileToBase64(f), mime: f.type, nomeFile: f.name, tipiCorso: tipi.map((t) => t.nome_corso), argomenti,
          aiConfig: { kind: aiAttiva.kind, baseUrl: aiAttiva.baseUrl, model: aiAttiva.model, apiKey: aiAttiva.apiKey },
        },
      });
      if (!r.ok) return void toast.error(r.errore);
      const d = r.dati;
      setTestoLetto(d.tipo_corso);
      const tipo = tipi.find((t) => t.nome_corso.toLowerCase() === d.tipo_corso.toLowerCase()) ?? piuSimile(d.tipo_corso, tipi).tipo;
      setSuggerito(tipo?.id ?? null);
      const { data: esistente } = d.codice_fiscale
        ? await sb.from("dipendenti").select("*").eq("codice_fiscale", pulisciCF(d.codice_fiscale)).maybeSingle()
        : { data: null };
      setForm({
        ...VUOTA,
        cognome: d.cognome.toUpperCase(), nome: d.nome.toUpperCase(), codice_fiscale: pulisciCF(d.codice_fiscale),
        data_nascita: d.data_nascita, luogo_nascita: d.luogo_nascita,
        codice_ateco: d.codice_ateco || esistente?.codice_ateco || "",
        email: esistente?.email ?? "", reparto: esistente?.reparto ?? "",
        tipo_corso_id: tipo?.id ?? null, tipo_corso_nome: tipo?.nome_corso ?? d.tipo_corso,
        data_corso: d.data_corso, ore: d.ore, ente: d.ente, argomenti: d.argomenti,
        esito: d.valutazione, note: d.motivazione,
        integrazione: d.valutazione === "Valido con integrazione DVR" ? (integrazioni[0] ?? "") : "",
      });
      toast.success(esistente ? "Dati letti — dipendente già presente in archivio" : "Dati letti: controllali a fianco del documento");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLettura(false);
    }
  }

  /** Ruota di 90° (in senso orario) il documento mostrato in anteprima: ogni clic ruota ancora. */
  async function ruota() {
    if (!anteprima || !anteprimaMime || ruotando) return;
    setRuotando(true);
    try {
      let sorgente = sorgenteRef.current;
      if (!sorgente) {
        // Riga riaperta dalla coda: scarico l'originale una sola volta
        if (!form.percorso_file) return;
        const { data, error } = await supabase.storage.from("attestati").download(form.percorso_file);
        if (error || !data) throw error ?? new Error("Download non riuscito");
        sorgente = data;
        sorgenteRef.current = data;
      }
      const nuovoAngolo = (rotazione + 90) % 360;
      const ruotato = await ruotaDocumento(sorgente, anteprimaMime, nuovoAngolo);
      setRotazione(nuovoAngolo);
      setAnteprima(URL.createObjectURL(ruotato));
    } catch (e) {
      toast.error(`Rotazione non riuscita: ${(e as Error).message}`);
    } finally {
      setRuotando(false);
    }
  }

  /** Cambia esito; con "Valido con note" propone subito la nota predefinita (se non c'è già una nota dell'elenco). */
  function scegliEsito(e: Esito) {
    setForm((f) => {
      const notaDellElenco = noteElenco.some((n) => n.testo === f.note);
      if (e === "Valido con note") return { ...f, esito: e, note: notaDellElenco ? f.note : NOTA_PREDEFINITA };
      return { ...f, esito: e, note: notaDellElenco ? "" : f.note };
    });
  }

  async function aggiungiNota() {
    const v = window.prompt("Nuova nota: verrà ricordata e potrai sceglierla anche in futuro", form.note);
    const testo = v?.trim();
    if (!testo) return;
    const esistente = noteElenco.find((n) => n.testo.toLowerCase() === testo.toLowerCase());
    if (esistente) { set("note", esistente.testo); return void toast.info("Nota già presente: l'ho selezionata"); }
    const { error } = await sb.from("note_valutazione").insert({ testo });
    if (error) return void toast.error(`Nota non salvata (${error.message}). Va creata la tabella note_valutazione: vedi il file SQL.`);
    qc.invalidateQueries({ queryKey: ["note-valutazione"] });
    set("note", testo);
    toast.success("Nota salvata nell'elenco");
  }

  async function eliminaNota(n: NotaVal) {
    if (!window.confirm(`Eliminare questa nota dall'elenco?\n\n${n.testo}`)) return;
    const { error } = await sb.from("note_valutazione").delete().eq("id", n.id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["note-valutazione"] });
    if (form.note === n.testo) set("note", "");
  }

  async function aggiungiVoce(tabella: "argomenti_corso" | "opzioni_integrazione") {
    const v = window.prompt(tabella === "argomenti_corso" ? "Nuovo argomento" : "Nuova integrazione DVR (es. Integrazione 12 ore)");
    if (!v?.trim()) return;
    const ore = Number(v.match(/(\d+)\s*or/)?.[1]) || null;
    const { error } = tabella === "argomenti_corso"
      ? await sb.from(tabella).insert({ nome: v.trim() })
      : await sb.from(tabella).insert({ etichetta: v.trim(), ore });
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: [tabella === "argomenti_corso" ? "argomenti" : "integrazioni"] });
    if (tabella === "opzioni_integrazione") set("integrazione", v.trim());
  }

  async function salvaInCoda() {
    if (!form.cognome || !form.codice_fiscale) return void toast.error("Servono almeno cognome e codice fiscale");
    if (form.esito === "Non valido" && !form.note.trim()) return void toast.error("Indica il motivo del rifiuto");
    if (form.esito === "Valido con note" && !form.note.trim()) return void toast.error("Scegli o scrivi la nota da allegare all'esito");
    if (!form.tipo_corso_id) return void toast.error("Scegli il corso codificato dal menu");
    const cf = pulisciCF(form.codice_fiscale);
    if (cf.length > 16) return void toast.error(`Codice fiscale troppo lungo (${cf.length} caratteri, ne servono 16): controllalo`);
    if (cf.length < 16) toast.warning(`Codice fiscale di ${cf.length} caratteri: di solito sono 16, controllalo`);
    let percorso = form.percorso_file, mime = form.mime_file;
    if (file) {
      mime = file.type;
      let blob: Blob = file;
      if (mime === "application/pdf" && totPagine > 1 && pagine.trim()) {
        const idx = parsePagine(pagine, totPagine);
        if (!idx.length) return void toast.error(`Pagine non valide (il documento ha ${totPagine} pagine)`);
        if (idx.length < totPagine) blob = await estraiPagine(file, idx);
      }
      percorso = `Coda/${crypto.randomUUID()}.${estensione(mime)}`;
      const { error } = await supabase.storage.from("attestati").upload(percorso, blob, { contentType: mime });
      if (error) return void toast.error(error.message);
    }
    const payload = pulisci({ ...form, codice_fiscale: cf, percorso_file: percorso, mime_file: mime, nome_file: nomeFileStandard(form, estensione(mime)) });
    const { error } = idInModifica
      ? await sb.from("coda_valutazioni").update(payload).eq("id", idInModifica)
      : await sb.from("coda_valutazioni").insert(payload);
    if (error) return void toast.error(error.message);
    ricarica();
    if (file && totPagine > 1 && !idInModifica) {
      toast.success("Aggiunto alla coda. Ora scegli le altre pagine e il corso successivo");
      setPagine("");
      setForm((f) => ({ ...f, tipo_corso_id: null, tipo_corso_nome: "", ore: null, argomenti: [], note: "", integrazione: "", argomenti_mancanti: [] }));
      return;
    }
    toast.success(idInModifica ? "Valutazione aggiornata" : "Aggiunto alla coda di lavoro");
    nuovo();
  }

  function nuovo() {
    setForm(VUOTA); setFile(null); setAnteprima(null); setAnteprimaMime(null); setIdInModifica(null);
    setTotPagine(0); setPagine(""); setTestoLetto(""); setSuggerito(null);
    sorgenteRef.current = null; setRotazione(0);
  }

  async function modifica(r: Riga) {
    const { id: _id, ...resto } = r;
    setForm(resto); setIdInModifica(r.id); setFile(null);
    sorgenteRef.current = null; setRotazione(0);
    setAnteprimaMime(r.mime_file);
    setAnteprima(r.percorso_file ? ((await supabase.storage.from("attestati").createSignedUrl(r.percorso_file, 3600)).data?.signedUrl ?? null) : null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function duplica(r: Riga) {
    const { error } = await sb.from("coda_valutazioni").insert(pulisci({ ...r, archiviato: false, inviato: false, tipo_corso_id: null, tipo_corso_nome: "" }));
    if (error) return void toast.error(error.message);
    toast.success("Riga duplicata: scegli il secondo corso con la matita");
    ricarica();
  }

  async function cancella(r: Riga) {
    if (!window.confirm(`Eliminare dalla coda ${r.cognome} ${r.nome} — ${r.tipo_corso_nome}?`)) return;
    const altri = coda.filter((x) => x.id !== r.id && x.percorso_file === r.percorso_file);
    if (r.percorso_file && !altri.length && !r.archiviato) await supabase.storage.from("attestati").remove([r.percorso_file]);
    await sb.from("coda_valutazioni").delete().eq("id", r.id);
    ricarica();
  }

  async function archivia(righe: Riga[]) {
    let ok = 0;
    const integrazioniCreateOra = new Set<string>();
    for (const r of righe) {
      if (r.archiviato) continue;
      try {
        if (!r.tipo_corso_id) throw new Error(`${r.cognome}: scegli il tipo di corso`);
        if (!r.data_corso) throw new Error(`${r.cognome}: manca la data del corso`);
        const cf = pulisciCF(r.codice_fiscale);
        if (!cf || cf.length > 16) throw new Error(`${r.cognome}: codice fiscale non valido (${cf.length} caratteri, ne servono 16): correggilo con la matita`);
        const dip = await upsertDipendente({
          codice_fiscale: cf, cognome: r.cognome, nome: r.nome, email: r.email || null,
          reparto: r.reparto || null, sottoreparto: null, classe_concorso: null, materia: null,
          luogo_nascita: r.luogo_nascita || null, data_nascita: r.data_nascita || null,
          codice_ateco: r.codice_ateco || null,
        });
        let percorsoFinale = r.percorso_file;
        if (r.percorso_file) {
          percorsoFinale = `${CARTELLA_ARCHIVIO}/${cartellaDipendente(dip)}/${nomeFileStandard(r, estensione(r.mime_file))}`;
          const { data: blob } = await supabase.storage.from("attestati").download(r.percorso_file);
          if (blob) await supabase.storage.from("attestati").upload(percorsoFinale, blob, { upsert: true, contentType: r.mime_file ?? "application/octet-stream" });
        }
        const { data: nuovo, error } = await supabase.from("attestati_caricati").insert({
          dipendente_id: dip.id, codice_fiscale: dip.codice_fiscale, tipo_corso_id: r.tipo_corso_id,
          data_corso: r.data_corso, ore_dichiarate: r.ore, url_foto_fronte: percorsoFinale, url_foto_retro: null,
          stato_validazione: r.esito === "Non valido" ? "Respinto" : "Approvato",
          note_rifiuto: r.esito === "Valido" ? (r.note || null) : riepilogo(r),
          data_validazione: new Date().toISOString(),
        }).select("id").single();
        if (error) throw error;
        await sb.from("coda_valutazioni").update({ archiviato: true }).eq("id", r.id);
        ok++;

        // Integrazioni DVR: crea il debito formativo oppure offre di chiudere quelli aperti
        try {
          if (r.esito === "Valido con integrazione DVR") {
            const creata = await creaIntegrazioneDvr({
              dipendente_id: dip.id, attestato_origine_id: nuovo?.id ?? null, tipo_corso_nome: r.tipo_corso_nome || null,
              descrizione: r.integrazione || "Integrazione DVR",
              ore: Number(r.integrazione.match(/(\d+)\s*or/i)?.[1]) || null,
              argomenti_mancanti: r.argomenti_mancanti,
            });
            integrazioniCreateOra.add(creata.id);
          } else if (r.esito !== "Non valido") {
            const aperte = (await getIntegrazioniDvrAperte(dip.id)).filter((i) => !integrazioniCreateOra.has(i.id));
            for (const i of aperte) {
              if (window.confirm(`${r.cognome} ${r.nome} ha un'integrazione DVR da completare (${i.descrizione}).\n\nChiuderla con questo attestato (${r.tipo_corso_nome}, ${formatData(r.data_corso)})?`)) {
                await chiudiIntegrazioneDvr(i.id, nuovo?.id ?? null);
              }
            }
          }
        } catch (e) {
          toast.error(`Attestato archiviato, ma integrazione DVR non aggiornata: ${(e as Error).message}`);
        }
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
    if (ok) toast.success(`${ok} attestat${ok === 1 ? "o archiviato" : "i archiviati"} nel database`);
    ricarica();
    qc.invalidateQueries();
  }

  async function inviaEmail(righe: Riga[]) {
    if (!righe.length) return;
    const destinatari = [...new Set(righe.map((r) => r.email).filter(Boolean))];
    const persone = [...new Set(righe.map((r) => `${r.cognome} ${r.nome}`))];
    const corpo = `Gentile ${persone.length === 1 ? persone[0] : "collega"},\n\ndi seguito l'esito della verifica degli attestati di formazione sicurezza (D.Lgs. 81/2008):\n\n${righe.map((r, i) => `${i + 1}) ${riepilogo(r)}`).join("\n\n")}\n\nCordiali saluti\nUfficio Sicurezza`;
    const oggetto = `Esito verifica attestati — ${persone.join(", ")}`;
    const corpoHtml = `<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt">Gentile ${esc(persone.length === 1 ? persone[0] : "collega")},<br><br>di seguito l'esito della verifica degli attestati di formazione sicurezza (D.Lgs. 81/2008):<br><br>${righe.map((r, i) => `${i + 1}) ${riepilogoHtml(r)}`).join("<br><br>")}<br><br>Cordiali saluti<br>Ufficio Sicurezza</div>`;
    const conFile = righe.filter((r) => r.percorso_file);

    if (!conFile.length) {
      // Nessun documento da allegare: resta il vecchio link mailto (solo testo)
      window.location.href = `mailto:${destinatari.join(",")}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`;
      toast.info(destinatari.length ? "Nessun file allegato alle righe: email con solo il testo" : "Nessun file e nessuna email salvata: aggiungi il destinatario nella posta");
    } else {
      try {
        // Scarico ogni documento e lo allego con il nome standard AAAA-MM_COGNOME_NOME_CF_TIPOCORSO.ext
        const allegati: AllegatoEml[] = [];
        const nomiUsati = new Set<string>();
        for (const r of conFile) {
          const { data: blob, error } = await supabase.storage.from("attestati").download(r.percorso_file as string);
          if (error || !blob) throw error ?? new Error(`Download non riuscito: ${r.cognome} ${r.nome}`);
          const nomeBase = nomeFileStandard(r, estensione(r.mime_file));
          let nome = nomeBase;
          for (let n = 2; nomiUsati.has(nome); n++) nome = nomeBase.replace(/(\.[^.]+)$/, `_${n}$1`);
          nomiUsati.add(nome);
          allegati.push({ nome, mime: r.mime_file ?? "application/octet-stream", blob });
        }
        const eml = await costruisciEml({ a: destinatari, oggetto, corpo, corpoHtml, allegati });
        scaricaBlob(eml, `Esito_verifica_attestati_${new Date().toISOString().slice(0, 10)}.eml`);
        toast.success(`Bozza email scaricata con ${allegati.length} allegat${allegati.length === 1 ? "o" : "i"}: aprila per inviarla`);
        if (conFile.length < righe.length) toast.warning(`${righe.length - conFile.length} righe senza documento: nessun allegato per quelle`);
        if (!destinatari.length) toast.info("Nessuna email salvata: aggiungi il destinatario nella bozza");
      } catch (e) {
        return void toast.error(`Preparazione email non riuscita: ${(e as Error).message}`);
      }
    }
    await sb.from("coda_valutazioni").update({ inviato: true }).in("id", righe.map((r) => r.id));
    ricarica();
  }

  async function salvaLocale(r: Riga) {
    if (!r.percorso_file) return void toast.error("Nessun file allegato");
    const nome = nomeFileStandard(r, estensione(r.mime_file));
    try {
      // Si apre "Salva con nome" con il nome già rinominato: scegli tu la cartella ogni volta
      const esito = await salvaFileConNome(
        async () => {
          const { data: blob, error } = await supabase.storage.from("attestati").download(r.percorso_file as string);
          if (error || !blob) throw error ?? new Error("Download non riuscito");
          return blob;
        },
        nome,
        r.mime_file ?? "application/octet-stream",
      );
      if (esito === "salvato") toast.success(`Salvato: ${nome}`);
      if (esito === "scaricato") toast.success(`File scaricato come ${nome} (cartella Download del browser)`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const selezione = useMemo(() => coda.filter((r) => selezionati.has(r.id)), [coda, selezionati]);
  const toggle = (id: string) => setSelezionati((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleArg = (k: "argomenti" | "argomenti_mancanti", a: string) =>
    set(k, form[k].includes(a) ? form[k].filter((x) => x !== a) : [...form[k], a]);
  const tuttiArgomenti = [...new Set([...argomenti, ...form.argomenti])];
  const nomeFinale = form.cognome && form.codice_fiscale && form.tipo_corso_nome ? nomeFileStandard(form, estensione(file?.type ?? form.mime_file)) : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Button asChild variant="ghost" size="sm"><Link to="/"><ArrowLeft className="h-4 w-4" /> Home</Link></Button>
          <h1 className="font-display text-lg font-semibold">Postazione Operatore — Verifica attestati</h1>
          <div className="ml-auto"><ImpostaAiButton /></div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="grid gap-4 lg:grid-cols-2">
          {/* Documento */}
          <div className="flex min-h-[560px] flex-col rounded-xl border bg-card p-3">
            <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) scegliFile(f); e.target.value = ""; }} />
            {anteprima ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-muted-foreground">{file?.name ?? form.nome_file}</span>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" /> Altro documento</Button>
                </div>
                {file && totPagine > 1 && (
                  <div className="mb-2 space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-2 text-sm">
                    <div className="font-medium">Documento di {totPagine} pagine — quali pagine salvare per questo corso?</div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button size="sm" variant={pagine === "" ? "default" : "outline"} onClick={() => setPagine("")}>Tutte</Button>
                      {Array.from({ length: totPagine }, (_, i) => String(i + 1)).map((p) => {
                        const sel = parsePagine(pagine, totPagine).includes(Number(p) - 1);
                        return (
                          <Button key={p} size="sm" variant={sel ? "default" : "outline"}
                            onClick={() => { const cur = new Set(parsePagine(pagine, totPagine).map((x) => x + 1)); if (cur.has(Number(p))) cur.delete(Number(p)); else cur.add(Number(p)); setPagine([...cur].sort((a, b) => a - b).join(",")); }}>
                            Pag. {p}
                          </Button>
                        );
                      })}
                      <Input className="h-8 w-28" placeholder="es. 1-2" value={pagine} onChange={(e) => setPagine(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted-foreground">Verrà salvato un PDF con le sole pagine scelte. Dopo l'aggiunta alla coda il documento resta aperto per il corso successivo.</p>
                  </div>
                )}
                <div className="relative flex min-h-[500px] flex-1 flex-col">
                  {anteprimaMime === "application/pdf"
                    ? <object key={anteprima} data={`${anteprima}#zoom=page-width`} type="application/pdf" className="h-full min-h-[500px] w-full flex-1 rounded-md border" />
                    : <img src={anteprima} alt="Attestato" className="max-h-[640px] w-full rounded-md border object-contain" />}
                  <Button size="icon" variant="outline" disabled={ruotando} onClick={ruota}
                    title={`Ruota di 90° (clicca ancora per continuare)${rotazione ? ` — ora ${rotazione}°` : ""}`} aria-label="Ruota di 90°"
                    className="absolute right-2 top-1.5 z-10 h-8 w-8 bg-background shadow-md [&_svg]:h-4 [&_svg]:w-4">
                    {ruotando ? <Loader2 className="animate-spin" /> : <RotateCw />}
                  </Button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) scegliFile(f); }}
                className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed text-center text-muted-foreground hover:border-primary hover:text-primary">
                <Sparkles className="h-10 w-10" />
                <span className="font-display text-lg font-semibold">Compila automaticamente da documento</span>
                <span className="text-sm">Clicca o trascina qui un PDF o una foto dell'attestato</span>
              </button>
            )}
          </div>

          {/* Modulo */}
          <div className="relative space-y-4 rounded-xl border bg-card p-4">
            {lettura && (
              <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-card/85 font-medium">
                <Loader2 className="h-5 w-5 animate-spin" /> Lettura del documento in corso…
              </div>
            )}
            <h2 className="font-display font-semibold">1. Dati del lavoratore {idInModifica && <span className="text-sm text-primary">(modifica riga in coda)</span>}</h2>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Cognome"><Input value={form.cognome} onChange={(e) => set("cognome", e.target.value.toUpperCase())} /></Campo>
              <Campo label="Nome"><Input value={form.nome} onChange={(e) => set("nome", e.target.value.toUpperCase())} /></Campo>
              <Campo label="Codice fiscale"><Input value={form.codice_fiscale} onChange={(e) => set("codice_fiscale", pulisciCF(e.target.value))} /></Campo>
              <Campo label="Codice ATECO"><Input value={form.codice_ateco} placeholder="es. 85.31.20" onChange={(e) => set("codice_ateco", e.target.value)} /></Campo>
              <Campo label="Data di nascita"><Input type="date" value={form.data_nascita} onChange={(e) => set("data_nascita", e.target.value)} /></Campo>
              <Campo label="Luogo di nascita"><Input value={form.luogo_nascita} onChange={(e) => set("luogo_nascita", e.target.value)} /></Campo>
            </div>

            <h2 className="font-display font-semibold">2. Corso</h2>
            <div className="grid grid-cols-2 gap-2">
              {testoLetto && (
                <p className="col-span-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  📄 Testo letto dal documento: <span className="font-medium text-foreground">"{testoLetto}"</span>
                </p>
              )}
              <Campo label="Corso codificato (archivio ufficiale)" className="col-span-2">
                <Select value={form.tipo_corso_id ?? ""} onValueChange={(v) => { const t = tipi.find((x: TipoCorso) => x.id === v); setForm((f) => ({ ...f, tipo_corso_id: v, tipo_corso_nome: t?.nome_corso ?? "" })); }}>
                  <SelectTrigger className={form.tipo_corso_id && form.tipo_corso_id === suggerito ? "border-primary ring-1 ring-primary" : ""}><SelectValue placeholder="Scegli il corso codificato" /></SelectTrigger>
                  <SelectContent>{classifica.map(({ t }) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.id === suggerito ? "⭐ " : ""}{t.macro_categoria} · {t.nome_corso} ({t.ore_minime_legge ?? "?"}h){t.id === suggerito ? " — più simile" : ""}
                    </SelectItem>
                  ))}</SelectContent>
                </Select>
                {suggerito && form.tipo_corso_id === suggerito && <span className="mt-1 block text-xs text-primary">⭐ Suggerito in base al documento — cambialo se serve</span>}
              </Campo>
              <Campo label="Data attestato"><Input type="date" value={form.data_corso} onChange={(e) => set("data_corso", e.target.value)} /></Campo>
              <Campo label="Ore"><Input type="number" value={form.ore ?? ""} onChange={(e) => set("ore", e.target.value ? Number(e.target.value) : null)} /></Campo>
              <Campo label="Ente formatore" className="col-span-2"><Input value={form.ente} onChange={(e) => set("ente", e.target.value)} /></Campo>
            </div>
            <Chips titolo="Argomenti trattati" voci={tuttiArgomenti} attivi={form.argomenti} onToggle={(a) => toggleArg("argomenti", a)} onAggiungi={() => aggiungiVoce("argomenti_corso")} />

            <h2 className="font-display font-semibold">3. Valutazione</h2>
            <div className="grid grid-cols-2 gap-2">
              {ESITI.map((e) => (
                <button key={e} type="button" onClick={() => scegliEsito(e)}
                  className={`rounded-lg border p-2 text-sm font-medium ${form.esito === e ? esitoClass(e) : "hover:bg-muted"}`}>{e}</button>
              ))}
            </div>
            {form.esito === "Valido con note" && (
              <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
                <span className="text-xs font-medium text-muted-foreground">Nota da allegare all'esito: scegline una (puoi modificarla nel campo sotto)</span>
                <div className="space-y-1">
                  {noteElenco.map((n) => (
                    <div key={n.id} className="flex items-start gap-1">
                      <button type="button" onClick={() => set("note", n.testo)}
                        className={`flex-1 rounded-md border p-2 text-left text-xs ${form.note === n.testo ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted"}`}>
                        {n.testo}{n.predefinita && <span className="ml-1 text-muted-foreground">(predefinita)</span>}
                      </button>
                      {!n.predefinita && (
                        <Button size="icon" variant="ghost" title="Elimina nota" aria-label="Elimina nota" onClick={() => eliminaNota(n)}
                          className="h-7 w-7 text-destructive [&_svg]:h-4 [&_svg]:w-4"><Trash2 /></Button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={aggiungiNota} className="rounded-full border border-dashed px-2 py-0.5 text-xs text-primary">+ Nuova nota (viene ricordata)</button>
              </div>
            )}
            {form.esito === "Valido con integrazione DVR" && (
              <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                <div className="flex gap-2">
                  <Select value={form.integrazione} onValueChange={(v) => set("integrazione", v)}>
                    <SelectTrigger><SelectValue placeholder="Integrazione richiesta" /></SelectTrigger>
                    <SelectContent>{integrazioni.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="icon" variant="outline" title="Nuova integrazione" onClick={() => aggiungiVoce("opzioni_integrazione")}><Plus className="h-4 w-4" /></Button>
                </div>
                <Chips titolo="Argomenti da integrare" voci={argomenti} attivi={form.argomenti_mancanti} onToggle={(a) => toggleArg("argomenti_mancanti", a)} onAggiungi={() => aggiungiVoce("argomenti_corso")} />
              </div>
            )}
            <Campo label={form.esito === "Non valido" ? "Motivo del rifiuto (obbligatorio)" : form.esito === "Valido con note" ? "Nota (modificabile)" : "Note / motivazione"}>
              <Textarea rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} />
            </Campo>
            {nomeFinale && <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs">File: {(form.data_corso || "0000-00").slice(0, 7)}/{nomeFinale}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={nuovo}>Svuota</Button>
              <Button onClick={salvaInCoda}><Plus className="h-4 w-4" /> {idInModifica ? "Salva modifiche" : "Aggiungi alla coda"}</Button>
            </div>
          </div>
        </section>

        {/* Coda */}
        <section className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <h2 className="font-display font-semibold">Coda di lavoro ({coda.length})</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={!selezione.length} onClick={() => archivia(selezione)}><DatabaseZap className="h-4 w-4" /> Aggiungi selezionati al DB</Button>
              <Button size="sm" disabled={!selezione.length} onClick={() => inviaEmail(selezione)}><Mail className="h-4 w-4" /> Unica email ({selezione.length})</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2"><Checkbox checked={coda.length > 0 && selezione.length === coda.length} onCheckedChange={(v) => setSelezionati(v ? new Set(coda.map((r) => r.id)) : new Set())} /></th>
                  <th className="p-2">Lavoratore</th><th className="p-2">Corso</th><th className="p-2">Data</th><th className="p-2">Esito</th><th className="p-2">Stato</th><th className="p-2 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {coda.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nessuna valutazione in coda</td></tr>}
                {coda.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2"><Checkbox checked={selezionati.has(r.id)} onCheckedChange={() => toggle(r.id)} /></td>
                    <td className="p-2"><div className="font-medium">{r.cognome} {r.nome}</div><div className="font-mono text-xs text-muted-foreground">{pulisciCF(r.codice_fiscale)}</div></td>
                    <td className="p-2">{r.tipo_corso_nome || <span className="text-destructive">da scegliere</span>}<div className="text-xs text-muted-foreground">{r.ore ?? "?"} ore</div></td>
                    <td className="p-2">{formatData(r.data_corso)}</td>
                    <td className="p-2"><span className={`rounded-full border px-2 py-0.5 text-xs ${esitoClass(r.esito)}`}>{r.esito}</span>{r.integrazione && r.esito === "Valido con integrazione DVR" && <div className="mt-1 text-xs text-muted-foreground">{r.integrazione}</div>}{r.esito === "Valido con note" && r.note && <div className="mt-1 max-w-[240px] truncate text-xs text-muted-foreground" title={r.note}>{r.note}</div>}</td>
                    <td className="p-2 text-xs">{r.archiviato ? <span className="text-success">Archiviato nel DB ✓</span> : "Bozza"}{r.inviato && <div className="text-primary">Email preparata</div>}</td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        <Icona t="Modifica" onClick={() => modifica(r)}><Pencil /></Icona>
                        <Icona t="Aggiungi al database" disabled={r.archiviato} onClick={() => archivia([r])}><DatabaseZap /></Icona>
                        <Icona t="Duplica" onClick={() => duplica(r)}><CopyPlus /></Icona>
                        <Icona t="Copia riepilogo" onClick={() => { navigator.clipboard.writeText(riepilogo(r)); toast.success("Copiato"); }}><Copy /></Icona>
                        <Icona t="Salva con nome (scegli la cartella)" onClick={() => salvaLocale(r)}><FolderDown /></Icona>
                        <Icona t="Invia email" onClick={() => inviaEmail([r])}><Mail /></Icona>
                        <Icona t="Cancella" onClick={() => cancella(r)} danger><Trash2 /></Icona>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function esitoClass(e: string) {
  if (e === "Valido") return "border-success/40 bg-success/12 text-success";
  if (e === "Non valido") return "border-destructive/40 bg-destructive/12 text-destructive";
  if (e === "Valido con note") return "border-primary/40 bg-primary/10 text-primary";
  return "border-warning/45 bg-warning/15 text-warning-foreground";
}

function Campo({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Chips({ titolo, voci, attivi, onToggle, onAggiungi }: { titolo: string; voci: string[]; attivi: string[]; onToggle: (a: string) => void; onAggiungi: () => void }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{titolo}</span>
      <div className="flex flex-wrap gap-1">
        {voci.map((a) => (
          <button key={a} type="button" onClick={() => onToggle(a)}
            className={`rounded-full border px-2 py-0.5 text-xs ${attivi.includes(a) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{a}</button>
        ))}
        <button type="button" onClick={onAggiungi} className="rounded-full border border-dashed px-2 py-0.5 text-xs text-primary">+ Aggiungi nuovo</button>
      </div>
    </div>
  );
}

function Icona({ t, onClick, children, danger, disabled }: { t: string; onClick: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <Button size="icon" variant="ghost" title={t} aria-label={t} disabled={disabled} onClick={onClick}
      className={`h-8 w-8 [&_svg]:h-4 [&_svg]:w-4 ${danger ? "text-destructive" : ""}`}>{children}</Button>
  );
}

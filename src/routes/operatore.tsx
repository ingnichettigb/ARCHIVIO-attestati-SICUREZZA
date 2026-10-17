/*
 * File:      operatore.tsx
 * Percorso:  src/routes/operatore.tsx
 * Postazione Operatore completa con estrazione AI, split-screen e coda bozze.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Archive, Check, Copy, Download, Edit3, Eye, FileText, Loader2, Mail, Plus,
  RotateCw, Sparkles, Crosshair, Trash2, X, ZoomIn, ZoomOut, RotateCcw
} from "lucide-react";
import { supabase as sb } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { estraiAttestato } from "@/lib/estrazione.functions";
import { getActiveProvider, useAiConfig } from "@/lib/ai-providers";
import { ImpostaAiButton } from "@/components/ImpostaAiDialog";
import { contaPagine, estraiPagine, parsePagine, piuSimile, somiglianza, renderizzaPrimaPaginaPdf } from "@/lib/pdf-pagine";
import { pulisciCF, upsertDipendente, CARTELLA_ARCHIVIO, cartellaDipendente, formatData, creaIntegrazioneDvr } from "@/lib/api";

type CodaRiga = Omit<Riga, "esito"> & {
  esito: string; percorso_file: string | null; mime_file: string | null; nome_file: string | null;
  archiviato: boolean; inviato: boolean; argomenti_mancanti: string[];
};
import { CatturaOcr } from "@/components/CatturaOcr";

type CampoOcr = "cognome" | "nome" | "codice_fiscale" | "codice_ateco" | "data_corso" | "ore" | "note";
const ETICHETTE_OCR: Record<CampoOcr, string> = { cognome: "Cognome", nome: "Nome", codice_fiscale: "Codice Fiscale", codice_ateco: "Codice ATECO", data_corso: "Data emanazione", ore: "Ore corso", note: "Note" };

function dataDaTesto(t: string): string {
  const m = t.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (!m) return "";
  let y = m[3]!; if (y.length === 2) y = "20" + y;
  return `${y}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
}

export const Route = createFileRoute("/operatore")({
  component: PostazioneOperatore,
});

interface TipoCorso {
  id: string;
  nome_corso: string;
  macro_categoria: string;
  livello_specifico: string;
  ore_minime_legge: number;
  durata_validita_anni: number | null;
}

interface Riga {
  id: string;
  cognome: string;
  nome: string;
  codice_fiscale: string;
  data_nascita: string;
  luogo_nascita: string;
  codice_ateco: string;
  email: string;
  reparto: string;
  tipo_corso_id: string | null;
  tipo_corso_nome: string;
  data_corso: string;
  ore: number | null;
  ente: string;
  argomenti: string[];
  esito: "Valido" | "Valido con integrazione DVR" | "Non valido";
  note: string;
  integrazione: string;
  pagine_salvate?: string;
  file_blob?: Blob;
  nome_file_originale?: string;
}

const VUOTA: Omit<Riga, "id"> = {
  cognome: "", nome: "", codice_fiscale: "", data_nascita: "", luogo_nascita: "", codice_ateco: "",
  email: "", reparto: "", tipo_corso_id: null, tipo_corso_nome: "", data_corso: "", ore: null,
  ente: "", argomenti: [], esito: "Valido", note: "", integrazione: "",
};

const NOTA_PREDEFINITA = "Attestato conforme ai requisiti previsti dall'Accordo Stato-Regioni.";

export function PostazioneOperatore() {
  const qc = useQueryClient();
  const [aiConfig] = useAiConfig();
  const aiAttiva = getActiveProvider(aiConfig);

  const { data: tipi = [] } = useQuery({
    queryKey: ["tipi_corso"],
    queryFn: async () => {
      const { data, error } = await sb.from("tipi_corso").select("*").order("nome_corso");
      if (error) throw error;
      return (data ?? []) as TipoCorso[];
    },
  });

  const { data: coda = [] } = useQuery({
    queryKey: ["coda"],
    queryFn: async () => {
      const { data, error } = await sb.from("coda_valutazioni").select("*").order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

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
  const sorgenteRef = useRef<Blob | null>(null);

  const [campoOcr, setCampoOcr] = useState<CampoOcr | null>(null);

  function incollaOcr(testo: string) {
    if (!campoOcr) return;
    if (!testo) return void toast.error("Nessun testo riconosciuto: riprova con un rettangolo più preciso");
    const c = campoOcr;
    if (c === "codice_fiscale") set("codice_fiscale", pulisciCF(testo));
    else if (c === "cognome" || c === "nome") set(c, testo.toUpperCase());
    else if (c === "data_corso") { const d = dataDaTesto(testo); if (!d) return void toast.error(`Data non riconosciuta in: "${testo}"`); set("data_corso", d); }
    else if (c === "ore") { const n = Number((testo.match(/\d+([.,]\d+)?/)?.[0] ?? "").replace(",", ".")); if (!n) return void toast.error("Numero non trovato"); set("ore", n); }
    else if (c === "note") set("note", form.note ? form.note + " " + testo : testo);
    else set(c, testo);
    toast.success(`${ETICHETTE_OCR[c]}: ${testo}`);
    setCampoOcr(null);
  }

  const Mirino = ({ campo }: { campo: CampoOcr }) => (
    <button type="button" disabled={!file}
      onClick={() => setCampoOcr(campoOcr === campo ? null : campo)}
      title={`Cattura ${ETICHETTE_OCR[campo]} dal documento`}
      className={`ml-1 inline-grid size-6 place-items-center rounded align-middle disabled:opacity-30 ${campoOcr === campo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
      <Crosshair className="size-3.5" />
    </button>
  );

  const set = <K extends keyof Riga>(k: K, v: Riga[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => () => { if (anteprima?.startsWith("blob:")) URL.revokeObjectURL(anteprima); }, [anteprima]);

  async function scegliFile(f: File) {
    if (!(f.type === "application/pdf" || f.type.startsWith("image/"))) return void toast.error("Carica un PDF o una foto");
    setFile(f);
    setAnteprima(URL.createObjectURL(f));
    setAnteprimaMime(f.type);
    sorgenteRef.current = f;
    setRotazione(0);
    setIdInModifica(null);
    setForm(VUOTA);
    setPagine("");
    setTestoLetto("");
    setSuggerito(null);
    setTotPagine(f.type === "application/pdf" ? await contaPagine(f).catch(() => 0) : 0);
    setLettura(true);

    try {
      const accettaPdfDiretto =
        aiAttiva.kind === "default" ||
        aiAttiva.id.includes("gemini") ||
        aiAttiva.model.toLowerCase().includes("gemini");

      let payloadBase64 = "";
      let payloadMime = f.type;

      if (f.type === "application/pdf" && !accettaPdfDiretto) {
        toast.info("Conversione PDF per l'AI in uso...");
        const img = await renderizzaPrimaPaginaPdf(f);
        payloadBase64 = img.base64;
        payloadMime = img.mime;
      } else {
        const buf = await f.arrayBuffer();
        let bin = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]!);
        payloadBase64 = btoa(bin);
      }

      const r = await estraiAttestato({
        data: {
          base64: payloadBase64,
          mime: payloadMime,
          nomeFile: f.name,
          tipiCorso: tipi.map((t) => t.nome_corso),
          argomenti: [],
          aiConfig: { kind: aiAttiva.kind, baseUrl: aiAttiva.baseUrl, model: aiAttiva.model, apiKey: aiAttiva.apiKey },
        },
      });

      if (!r.ok) return void toast.error(r.errore);
      const d = r.dati;
      setTestoLetto(d.tipo_corso);
      const tipo = tipi.find((t) => t.nome_corso.toLowerCase() === d.tipo_corso.toLowerCase()) ?? piuSimile(d.tipo_corso, tipi).tipo;
      setSuggerito(tipo?.id ?? null);

      const cf = pulisciCF(d.codice_fiscale);
      const { data: esistente } = cf
        ? await sb.from("dipendenti").select("*").eq("codice_fiscale", cf).maybeSingle()
        : { data: null };

      setForm({
        ...VUOTA,
        cognome: d.cognome.toUpperCase(),
        nome: d.nome.toUpperCase(),
        codice_fiscale: cf,
        data_nascita: d.data_nascita,
        luogo_nascita: d.luogo_nascita,
        codice_ateco: d.codice_ateco || esistente?.codice_ateco || "",
        email: esistente?.email ?? "",
        reparto: esistente?.reparto ?? "",
        tipo_corso_id: tipo?.id ?? null,
        tipo_corso_nome: tipo?.nome_corso ?? d.tipo_corso,
        data_corso: d.data_corso,
        ore: d.ore,
        ente: d.ente,
        argomenti: d.argomenti,
        esito: d.valutazione,
        note: d.motivazione || NOTA_PREDEFINITA,
        integrazione: "",
      });
      toast.success(esistente ? "Dati estratti (dipendente già presente)" : "Dati estratti con successo");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLettura(false);
    }
  }

  // ================= Salvataggio, coda di lavoro, archiviazione =================
  const db = sb as any;
  const [salvando, setSalvando] = useState(false);
  const righeCoda = coda as CodaRiga[];
  const ricarica = () => qc.invalidateQueries({ queryKey: ["coda"] });
  const selezione = useMemo(() => righeCoda.filter((r) => selezionati.has(r.id)), [righeCoda, selezionati]);
  const toggleSel = (id: string) => setSelezionati((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const est = (mime: string | null | undefined) => (mime === "application/pdf" ? "pdf" : mime?.split("/")[1]?.replace("jpeg", "jpg") || "jpg");

  function nuovo() {
    setForm(VUOTA); setFile(null); setAnteprima(null); setAnteprimaMime(null); setIdInModifica(null);
    setPagine(""); setTotPagine(0); sorgenteRef.current = null; setCampoOcr(null);
  }

  async function salvaInCoda(archiviaSubito: boolean) {
    if (!form.cognome || !form.codice_fiscale) return void toast.error("Servono almeno cognome e codice fiscale");
    if (form.esito === "Non valido" && !form.note.trim()) return void toast.error("Indica il motivo del rifiuto nelle note");
    setSalvando(true);
    try {
      let percorso: string | null = idInModifica ? (righeCoda.find((r) => r.id === idInModifica)?.percorso_file ?? null) : null;
      let mime: string | null = idInModifica ? (righeCoda.find((r) => r.id === idInModifica)?.mime_file ?? null) : null;
      if (file) {
        let blob: Blob = file;
        mime = file.type;
        if (file.type === "application/pdf" && pagine.trim() && totPagine > 0) {
          const idx = parsePagine(pagine, totPagine).map((n) => n - 1);
          if (idx.length) blob = await estraiPagine(file, idx);
        }
        percorso = `Coda/${crypto.randomUUID()}.${est(mime)}`;
        const { error } = await sb.storage.from("attestati").upload(percorso, blob, { contentType: mime });
        if (error) throw error;
      }
      const { file_blob: _b, nome_file_originale: _n, pagine_salvate: _p, ...dati } = form as Riga;
      const payload = {
        ...dati,
        data_nascita: dati.data_nascita || null,
        data_corso: dati.data_corso || null,
        percorso_file: percorso, mime_file: mime, nome_file: nomeFileStandard(form).replace(/\.pdf$/, `.${est(mime)}`),
      };
      const res = idInModifica
        ? await db.from("coda_valutazioni").update(payload).eq("id", idInModifica).select().single()
        : await db.from("coda_valutazioni").insert(payload).select().single();
      if (res.error) throw res.error;
      if (archiviaSubito) await archivia([{ ...VUOTA, ...res.data } as CodaRiga]);
      else toast.success(idInModifica ? "Valutazione aggiornata" : "Aggiunto alla coda di lavoro");
      nuovo();
      ricarica();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function modifica(r: CodaRiga) {
    const base = { ...VUOTA } as Record<string, unknown>;
    for (const k of Object.keys(VUOTA)) base[k] = (r as any)[k] ?? (VUOTA as any)[k];
    setForm(base as Omit<Riga, "id">);
    setIdInModifica(r.id); setFile(null); setPagine(""); setTotPagine(0);
    setAnteprimaMime(r.mime_file);
    setAnteprima(r.percorso_file ? ((await sb.storage.from("attestati").createSignedUrl(r.percorso_file, 3600)).data?.signedUrl ?? null) : null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function duplica(r: CodaRiga) {
    const { id: _i, created_at: _c, updated_at: _u, ...resto } = r as any;
    const { error } = await db.from("coda_valutazioni").insert({ ...resto, archiviato: false, inviato: false, tipo_corso_id: null, tipo_corso_nome: "" });
    if (error) return void toast.error(error.message);
    toast.success("Riga duplicata: scegli il secondo corso con la matita");
    ricarica();
  }

  async function cancella(r: CodaRiga) {
    if (!window.confirm(`Eliminare dalla coda ${r.cognome} ${r.nome} — ${r.tipo_corso_nome}?`)) return;
    const altri = righeCoda.filter((x) => x.id !== r.id && x.percorso_file === r.percorso_file);
    if (r.percorso_file && !altri.length && !r.archiviato) await sb.storage.from("attestati").remove([r.percorso_file]);
    await db.from("coda_valutazioni").delete().eq("id", r.id);
    ricarica();
  }

  function riepilogo(r: CodaRiga) {
    let s = `${r.cognome} ${r.nome} (${r.codice_fiscale})\nCorso: ${r.tipo_corso_nome} — ${formatData(r.data_corso)} — ${r.ore ?? "?"} ore\nEsito: ${r.esito}`;
    if (r.esito === "Valido con integrazione DVR" && r.integrazione) s += `\nIntegrazione richiesta: ${r.integrazione}`;
    if (r.note) s += `\nNote: ${r.note}`;
    return s;
  }

  async function archivia(righe: CodaRiga[]) {
    let ok = 0;
    for (const r of righe) {
      if (r.archiviato) continue;
      try {
        if (!r.tipo_corso_id) throw new Error(`${r.cognome}: scegli il tipo di corso`);
        if (!r.data_corso) throw new Error(`${r.cognome}: manca la data del corso`);
        const dip = await upsertDipendente({
          codice_fiscale: pulisciCF(r.codice_fiscale), cognome: r.cognome, nome: r.nome, email: r.email || null,
          reparto: r.reparto || null, sottoreparto: null, classe_concorso: null, materia: null,
          luogo_nascita: r.luogo_nascita || null, data_nascita: r.data_nascita || null,
          ...(r.codice_ateco ? { codice_ateco: r.codice_ateco } : {}),
        });
        let percorsoFinale = r.percorso_file;
        if (r.percorso_file) {
          percorsoFinale = `${CARTELLA_ARCHIVIO}/${cartellaDipendente(dip)}/${nomeFileStandard(r).replace(/\.pdf$/, `.${est(r.mime_file)}`)}`;
          const { data: blob } = await sb.storage.from("attestati").download(r.percorso_file);
          if (blob) await sb.storage.from("attestati").upload(percorsoFinale, blob, { upsert: true, contentType: r.mime_file ?? undefined });
        }
        const { data: att, error } = await db.from("attestati_caricati").insert({
          dipendente_id: dip.id, codice_fiscale: dip.codice_fiscale, tipo_corso_id: r.tipo_corso_id,
          data_corso: r.data_corso, ore_dichiarate: r.ore, url_foto_fronte: percorsoFinale, url_foto_retro: null,
          stato_validazione: r.esito === "Non valido" ? "Respinto" : "Approvato",
          note_rifiuto: r.esito === "Valido" ? (r.note || null) : riepilogo(r),
          data_validazione: new Date().toISOString(),
        }).select("id").single();
        if (error) throw error;
        if (r.esito === "Valido con integrazione DVR") {
          await creaIntegrazioneDvr({
            dipendente_id: dip.id, attestato_origine_id: att?.id ?? null, tipo_corso_nome: r.tipo_corso_nome || null,
            descrizione: r.integrazione || r.note || "Integrazione DVR richiesta",
            ore: Number(r.integrazione?.match(/(\d+)\s*or/)?.[1]) || null,
            argomenti_mancanti: r.argomenti_mancanti ?? [],
          }).catch((e) => toast.error(`Integrazione DVR non registrata: ${(e as Error).message}`));
        }
        await db.from("coda_valutazioni").update({ archiviato: true }).eq("id", r.id);
        ok++;
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
    if (ok) toast.success(`${ok} attestat${ok === 1 ? "o archiviato" : "i archiviati"} nel database`);
    ricarica();
    qc.invalidateQueries();
  }

  async function inviaEmail(righe: CodaRiga[]) {
    if (!righe.length) return;
    const destinatari = [...new Set(righe.map((r) => r.email).filter(Boolean))];
    const persone = [...new Set(righe.map((r) => `${r.cognome} ${r.nome}`))];
    const corpo = `Gentile ${persone.length === 1 ? persone[0] : "collega"},\n\ndi seguito l'esito della verifica degli attestati di formazione sicurezza (D.Lgs. 81/2008):\n\n${righe.map((r, i) => `${i + 1}) ${riepilogo(r)}`).join("\n\n")}\n\nCordiali saluti\nUfficio Sicurezza`;
    const oggetto = `Esito verifica attestati — ${persone.join(", ")}`;
    window.location.href = `mailto:${destinatari.join(",")}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`;
    if (!destinatari.length) toast.info("Nessuna email salvata: aggiungi il destinatario nella posta");
    await db.from("coda_valutazioni").update({ inviato: true }).in("id", righe.map((r) => r.id));
    ricarica();
  }

  async function salvaLocale(r: CodaRiga) {
    if (!r.percorso_file) return void toast.error("Nessun file allegato");
    const { data: blob, error } = await sb.storage.from("attestati").download(r.percorso_file);
    if (error || !blob) return void toast.error("Download non riuscito");
    const nome = nomeFileStandard(r).replace(/\.pdf$/, `.${est(r.mime_file)}`);
    const w = window as any;
    try {
      if (w.showSaveFilePicker) {
        const h = await w.showSaveFilePicker({ suggestedName: nome });
        const wr = await h.createWritable(); await wr.write(blob); await wr.close();
      } else {
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nome; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }
      toast.success(`Salvato: ${nome}`);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message);
    }
  }

  function nomeFileStandard(r: Pick<Riga, "data_corso" | "cognome" | "nome" | "codice_fiscale" | "tipo_corso_nome">) {
    const dataPrefix = r.data_corso ? r.data_corso.slice(0, 7) : "ANNO-MANCANTE";
    const cf = r.codice_fiscale || "SENZACF";
    const corso = (r.tipo_corso_nome || "CORSO").replace(/[^a-zA-Z0-9]/g, "_");
    return `${dataPrefix}_${r.cognome || "COGNOME"}_${r.nome || "NOME"}_${cf}_${corso}.pdf`;
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6">
      {/* Intestazione Superiore */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
               <div className="flex items-center gap-3">
          <Link
            to="/"
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Torna alla home"
            aria-label="Torna alla home"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Postazione Operatore</h1>
            <p className="text-sm text-muted-foreground">Verifica, lettura automatica con AI e archiviazione attestati</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ImpostaAiButton />
          <Button onClick={() => inputRef.current?.click()} className="gap-2">
            <Plus className="size-4" /> Carica documento
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) scegliFile(f);
            }}
          />
        </div>
      </div>

      {/* Area di Lavoro Split Screen */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Colonna Sinistra: Visualizzatore Documento */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Documento caricato</CardTitle>
            {anteprima && (
              <span className="text-xs text-muted-foreground">
                {file?.name} {totPagine > 0 && `(${totPagine} pag.)`}
              </span>
            )}
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-[500px] flex items-center justify-center bg-muted/20 relative">
            {lettura && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Lettura attestato con {aiAttiva.name}...</p>
              </div>
            )}
            {anteprima && file && campoOcr ? (
              <CatturaOcr file={file} isPdf={anteprimaMime === "application/pdf"} totPagine={totPagine}
                etichettaCampo={ETICHETTE_OCR[campoOcr]} onTesto={incollaOcr} />
            ) : anteprima ? (
              anteprimaMime === "application/pdf" ? (
                <iframe src={anteprima} className="w-full h-full min-h-[500px] border-none" title="Anteprima PDF" />
              ) : (
                <img src={anteprima} alt="Anteprima" className="max-h-[550px] object-contain p-2" />
              )
            ) : (
              <div className="text-center p-6 text-muted-foreground">
                <FileText className="size-12 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Trascina o carica un file PDF o una foto per iniziare</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Colonna Destra: Modulo Dati Riconosciuti */}
        <Card>
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-medium">Dati estratti e valutazione</CardTitle>
            <p className="text-xs text-muted-foreground">Clicca il mirino accanto a un campo, poi disegna un rettangolo sul documento per copiarne il testo.</p>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cog">Cognome<Mirino campo="cognome" /></Label>
                <Input id="cog" value={form.cognome} onChange={(e) => set("cognome", e.target.value.toUpperCase())} />
              </div>
              <div>
                <Label htmlFor="nom">Nome<Mirino campo="nome" /></Label>
                <Input id="nom" value={form.nome} onChange={(e) => set("nome", e.target.value.toUpperCase())} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cf">Codice Fiscale<Mirino campo="codice_fiscale" /></Label>
                <Input id="cf" value={form.codice_fiscale} onChange={(e) => set("codice_fiscale", pulisciCF(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="ateco">Codice ATECO<Mirino campo="codice_ateco" /></Label>
                <Input id="ateco" value={form.codice_ateco} onChange={(e) => set("codice_ateco", e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Corso identificato</Label>
              <Select
                value={form.tipo_corso_id ?? ""}
                onValueChange={(val) => {
                  const t = tipi.find((x) => x.id === val);
                  set("tipo_corso_id", val);
                  if (t) set("tipo_corso_nome", t.nome_corso);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona corso..." />
                </SelectTrigger>
                <SelectContent>
                  {tipi.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome_corso}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="dt">Data emanazione<Mirino campo="data_corso" /></Label>
                <Input id="dt" type="date" value={form.data_corso} onChange={(e) => set("data_corso", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="ore">Ore corso<Mirino campo="ore" /></Label>
                <Input id="ore" type="number" value={form.ore ?? ""} onChange={(e) => set("ore", Number(e.target.value) || null)} />
              </div>
              <div>
                <Label htmlFor="esito">Esito</Label>
                <Select value={form.esito} onValueChange={(val: any) => set("esito", val)}>
                  <SelectTrigger id="esito">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Valido">Valido</SelectItem>
                    <SelectItem value="Valido con integrazione DVR">Valido con integrazione DVR</SelectItem>
                    <SelectItem value="Non valido">Non valido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="note">Note valutazione<Mirino campo="note" /></Label>
              <Textarea id="note" rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} />
            </div>

            <div className="rounded-md border p-3 bg-muted/30 text-xs font-mono break-all">
              <span className="font-semibold text-muted-foreground block mb-1">Nome file archiviazione:</span>
              {nomeFileStandard(form)}
            </div>

            {totPagine > 1 && (
              <div>
                <Label htmlFor="pag">Pagine da salvare per questo corso (es. 1-2 oppure 3)</Label>
                <Input id="pag" placeholder={`Tutte (1-${totPagine})`} value={pagine} onChange={(e) => setPagine(e.target.value)} />
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={nuovo}><X className="size-4" /> Svuota</Button>
              <Button variant="outline" disabled={salvando} onClick={() => salvaInCoda(true)}><Archive className="size-4" /> Archivia subito nel DB</Button>
              <Button disabled={salvando} onClick={() => salvaInCoda(false)}>
                {salvando ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {idInModifica ? "Salva modifiche" : "Aggiungi alla coda"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coda di lavoro */}
      <Card>
        <CardHeader className="py-3 px-4 border-b flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Coda di lavoro ({righeCoda.length})</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!selezione.length} onClick={() => archivia(selezione)}><Archive className="size-4" /> Aggiungi selezionati al DB</Button>
            <Button size="sm" disabled={!selezione.length} onClick={() => inviaEmail(selezione)}><Mail className="size-4" /> Unica email ({selezione.length})</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2"><Checkbox checked={righeCoda.length > 0 && selezione.length === righeCoda.length} onCheckedChange={(v) => setSelezionati(v ? new Set(righeCoda.map((r) => r.id)) : new Set())} /></th>
                <th className="p-2">Lavoratore</th><th className="p-2">Corso</th><th className="p-2">Data</th><th className="p-2">Esito</th><th className="p-2">Stato</th><th className="p-2 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {righeCoda.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nessuna valutazione in coda</td></tr>}
              {righeCoda.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2"><Checkbox checked={selezionati.has(r.id)} onCheckedChange={() => toggleSel(r.id)} /></td>
                  <td className="p-2"><div className="font-medium">{r.cognome} {r.nome}</div><div className="font-mono text-xs text-muted-foreground">{r.codice_fiscale}</div></td>
                  <td className="p-2">{r.tipo_corso_nome || <span className="text-destructive">da scegliere</span>}<div className="text-xs text-muted-foreground">{r.ore ?? "?"} ore</div></td>
                  <td className="p-2">{formatData(r.data_corso)}</td>
                  <td className="p-2"><Badge variant={r.esito === "Non valido" ? "destructive" : r.esito === "Valido" ? "default" : "secondary"}>{r.esito}</Badge></td>
                  <td className="p-2 text-xs">{r.archiviato ? <span className="text-primary">Archiviato nel DB ✓</span> : "Bozza"}{r.inviato && <div className="text-muted-foreground">Email preparata</div>}</td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      <Icona t="Modifica" onClick={() => modifica(r)}><Edit3 /></Icona>
                      <Icona t="Aggiungi al database" disabled={r.archiviato} onClick={() => archivia([r])}><Archive /></Icona>
                      <Icona t="Duplica (altro corso nello stesso file)" onClick={() => duplica(r)}><Copy /></Icona>
                      <Icona t="Salva sul PC con nome" onClick={() => salvaLocale(r)}><Download /></Icona>
                      <Icona t="Invia email" onClick={() => inviaEmail([r])}><Mail /></Icona>
                      <Icona t="Elimina dalla coda" danger onClick={() => cancella(r)}><Trash2 /></Icona>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Icona({ t, onClick, children, danger, disabled }: { t: string; onClick: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <Button size="icon" variant="ghost" title={t} aria-label={t} disabled={disabled} onClick={onClick}
      className={`h-8 w-8 [&_svg]:h-4 [&_svg]:w-4 ${danger ? "text-destructive" : ""}`}>{children}</Button>
  );
}

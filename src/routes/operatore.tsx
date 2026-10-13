import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Copy, CopyPlus, DatabaseZap, FolderDown, Mail, Plus, Sparkles, Trash2, Upload, Loader2, Pencil,
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
  type TipoCorso,
} from "@/lib/api";
import { estraiAttestato } from "@/lib/estrazione.functions";
import { contaPagine, estraiPagine, parsePagine, piuSimile, somiglianza } from "@/lib/pdf-pagine";

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

type Esito = "Valido" | "Valido con integrazione DVR" | "Non valido";
const ESITI: Esito[] = ["Valido", "Valido con integrazione DVR", "Non valido"];

type Riga = {
  id: string;
  cognome: string; nome: string; codice_fiscale: string; email: string; luogo_nascita: string;
  data_nascita: string; reparto: string;
  tipo_corso_id: string | null; tipo_corso_nome: string; data_corso: string; ore: number | null; ente: string;
  argomenti: string[]; esito: Esito; integrazione: string; argomenti_mancanti: string[]; note: string;
  percorso_file: string | null; mime_file: string | null; nome_file: string | null;
  archiviato: boolean; inviato: boolean; created_at?: string;
};

const VUOTA: Omit<Riga, "id"> = {
  cognome: "", nome: "", codice_fiscale: "", email: "", luogo_nascita: "", data_nascita: "", reparto: "",
  tipo_corso_id: null, tipo_corso_nome: "", data_corso: "", ore: null, ente: "", argomenti: [],
  esito: "Valido", integrazione: "", argomenti_mancanti: [], note: "",
  percorso_file: null, mime_file: null, nome_file: null, archiviato: false, inviato: false,
};

/** AAAA-MM_COGNOME_NOME_CF_TIPOCORSO.ext */
export function nomeFileStandard(r: Pick<Riga, "data_corso" | "cognome" | "nome" | "codice_fiscale" | "tipo_corso_nome">, ext = "pdf") {
  const am = (r.data_corso || "").slice(0, 7) || "0000-00";
  return `${am}_${normalizzaNome(r.cognome)}_${normalizzaNome(r.nome)}_${r.codice_fiscale.toUpperCase()}_${normalizzaNome(r.tipo_corso_nome)}.${ext}`;
}
const estensione = (mime: string | null) => (mime === "application/pdf" ? "pdf" : mime?.split("/")[1]?.replace("jpeg", "jpg") || "jpg");

function pulisci(r: Partial<Riga>) {
  const { id: _i, created_at: _c, ...resto } = r as Riga;
  return { ...resto, data_nascita: resto.data_nascita || null, data_corso: resto.data_corso || null };
}

function riepilogo(r: Riga) {
  let s = `${r.cognome} ${r.nome} (${r.codice_fiscale})\nCorso: ${r.tipo_corso_nome} — ${formatData(r.data_corso)} — ${r.ore ?? "?"} ore\nEsito: ${r.esito}`;
  if (r.esito === "Valido con integrazione DVR") s += `\nIntegrazione richiesta: ${r.integrazione}${r.argomenti_mancanti.length ? `\nArgomenti da integrare: ${r.argomenti_mancanti.join(", ")}` : ""}`;
  if (r.note) s += `\nNote: ${r.note}`;
  return s;
}

const fileToBase64 = (f: Blob) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1] ?? "");
    fr.onerror = rej;
    fr.readAsDataURL(f);
  });

type DirH = { name: string; getDirectoryHandle: (n: string, o?: { create?: boolean }) => Promise<DirH>; getFileHandle: (n: string, o?: { create?: boolean }) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }> };
let cartellaScelta: DirH | null = null;

function Operatore() {
  const qc = useQueryClient();
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
    setIdInModifica(null);
    setForm(VUOTA);
    setPagine(""); setTestoLetto(""); setSuggerito(null);
    setTotPagine(f.type === "application/pdf" ? await contaPagine(f).catch(() => 0) : 0);
    setLettura(true);
    try {
      const r = await estraiAttestato({
        data: { base64: await fileToBase64(f), mime: f.type, nomeFile: f.name, tipiCorso: tipi.map((t) => t.nome_corso), argomenti },
      });
      if (!r.ok) return void toast.error(r.errore);
      const d = r.dati;
      setTestoLetto(d.tipo_corso);
      const tipo = tipi.find((t) => t.nome_corso.toLowerCase() === d.tipo_corso.toLowerCase()) ?? piuSimile(d.tipo_corso, tipi).tipo;
      setSuggerito(tipo?.id ?? null);
      const { data: esistente } = d.codice_fiscale
        ? await sb.from("dipendenti").select("*").eq("codice_fiscale", d.codice_fiscale.toUpperCase()).maybeSingle()
        : { data: null };
      setForm({
        ...VUOTA,
        cognome: d.cognome.toUpperCase(), nome: d.nome.toUpperCase(), codice_fiscale: d.codice_fiscale.toUpperCase(),
        data_nascita: d.data_nascita, luogo_nascita: d.luogo_nascita,
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
    if (!form.tipo_corso_id) return void toast.error("Scegli il corso codificato dal menu");
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
    const payload = pulisci({ ...form, percorso_file: percorso, mime_file: mime, nome_file: nomeFileStandard(form, estensione(mime)) });
    const { error } = idInModifica
      ? await sb.from("coda_valutazioni").update(payload).eq("id", idInModifica)
      : await sb.from("coda_valutazioni").insert(payload);
    if (error) return void toast.error(error.message);
    ricarica();
    if (file && totPagine > 1 && !idInModifica) {
      // Documento multi-corso: resta aperto per archiviare le altre pagine
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
  }

  async function modifica(r: Riga) {
    const { id: _id, ...resto } = r;
    setForm(resto); setIdInModifica(r.id); setFile(null);
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
    for (const r of righe) {
      if (r.archiviato) continue;
      try {
        if (!r.tipo_corso_id) throw new Error(`${r.cognome}: scegli il tipo di corso`);
        if (!r.data_corso) throw new Error(`${r.cognome}: manca la data del corso`);
        const dip = await upsertDipendente({
          codice_fiscale: r.codice_fiscale, cognome: r.cognome, nome: r.nome, email: r.email || null,
          reparto: r.reparto || null, sottoreparto: null, classe_concorso: null, materia: null,
          luogo_nascita: r.luogo_nascita || null, data_nascita: r.data_nascita || null,
        });
        let percorsoFinale = r.percorso_file;
        if (r.percorso_file) {
          percorsoFinale = `${CARTELLA_ARCHIVIO}/${cartellaDipendente(dip)}/${nomeFileStandard(r, estensione(r.mime_file))}`;
          const { data: blob } = await supabase.storage.from("attestati").download(r.percorso_file);
          if (blob) await supabase.storage.from("attestati").upload(percorsoFinale, blob, { upsert: true, contentType: r.mime_file ?? "application/octet-stream" });
        }
        const { error } = await supabase.from("attestati_caricati").insert({
          dipendente_id: dip.id, codice_fiscale: dip.codice_fiscale, tipo_corso_id: r.tipo_corso_id,
          data_corso: r.data_corso, ore_dichiarate: r.ore, url_foto_fronte: percorsoFinale, url_foto_retro: null,
          stato_validazione: r.esito === "Non valido" ? "Respinto" : "Approvato",
          note_rifiuto: r.esito === "Valido" ? (r.note || null) : riepilogo(r),
          data_validazione: new Date().toISOString(),
        });
        if (error) throw error;
        await sb.from("coda_valutazioni").update({ archiviato: true }).eq("id", r.id);
        ok++;
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
    window.location.href = `mailto:${destinatari.join(",")}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`;
    if (!destinatari.length) toast.info("Nessuna email salvata: aggiungi il destinatario nella posta");
    await sb.from("coda_valutazioni").update({ inviato: true }).in("id", righe.map((r) => r.id));
    ricarica();
  }

  async function salvaLocale(r: Riga) {
    const w = window as unknown as { showDirectoryPicker?: (o?: unknown) => Promise<DirH> };
    if (!w.showDirectoryPicker) return void toast.error("Salvataggio in cartella disponibile solo su Chrome o Edge da computer");
    if (!r.percorso_file) return void toast.error("Nessun file allegato");
    try {
      if (!cartellaScelta) cartellaScelta = await w.showDirectoryPicker({ id: "attestati-operatore", mode: "readwrite", startIn: "documents" });
      const sotto = (r.data_corso || "0000-00").slice(0, 7);
      const dir = await cartellaScelta.getDirectoryHandle(sotto, { create: true });
      const nome = nomeFileStandard(r, estensione(r.mime_file));
      try {
        await dir.getFileHandle(nome);
        if (!window.confirm(`"${nome}" esiste già. Sovrascrivere?`)) return;
      } catch { /* non esiste */ }
      const { data: blob, error } = await supabase.storage.from("attestati").download(r.percorso_file);
      if (error || !blob) throw error ?? new Error("Download non riuscito");
      const h = await dir.getFileHandle(nome, { create: true });
      const wr = await h.createWritable();
      await wr.write(blob);
      await wr.close();
      toast.success(`Salvato in ${cartellaScelta.name}/${sotto}/${nome}`);
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message);
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
                  <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}><Upload className="h-4 w-4" /> Altro documento</Button>
                </div>
                {anteprimaMime === "application/pdf"
                  ? <object data={anteprima} type="application/pdf" className="h-full min-h-[500px] w-full flex-1 rounded-md border" />
                  : <img src={anteprima} alt="Attestato" className="max-h-[640px] w-full rounded-md border object-contain" />}
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
              <Campo label="Codice fiscale"><Input value={form.codice_fiscale} onChange={(e) => set("codice_fiscale", e.target.value.toUpperCase())} /></Campo>
              <Campo label="Email"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Campo>
              <Campo label="Data di nascita"><Input type="date" value={form.data_nascita} onChange={(e) => set("data_nascita", e.target.value)} /></Campo>
              <Campo label="Luogo di nascita"><Input value={form.luogo_nascita} onChange={(e) => set("luogo_nascita", e.target.value)} /></Campo>
            </div>

            <h2 className="font-display font-semibold">2. Corso</h2>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Tipo di corso" className="col-span-2">
                <Select value={form.tipo_corso_id ?? ""} onValueChange={(v) => { const t = tipi.find((x: TipoCorso) => x.id === v); setForm((f) => ({ ...f, tipo_corso_id: v, tipo_corso_nome: t?.nome_corso ?? "" })); }}>
                  <SelectTrigger><SelectValue placeholder={form.tipo_corso_nome ? `Letto: ${form.tipo_corso_nome} — scegli` : "Scegli il corso"} /></SelectTrigger>
                  <SelectContent>{tipi.map((t) => <SelectItem key={t.id} value={t.id}>{t.macro_categoria} · {t.nome_corso} ({t.ore_minime_legge ?? "?"}h)</SelectItem>)}</SelectContent>
                </Select>
              </Campo>
              <Campo label="Data attestato"><Input type="date" value={form.data_corso} onChange={(e) => set("data_corso", e.target.value)} /></Campo>
              <Campo label="Ore"><Input type="number" value={form.ore ?? ""} onChange={(e) => set("ore", e.target.value ? Number(e.target.value) : null)} /></Campo>
              <Campo label="Ente formatore" className="col-span-2"><Input value={form.ente} onChange={(e) => set("ente", e.target.value)} /></Campo>
            </div>
            <Chips titolo="Argomenti trattati" voci={tuttiArgomenti} attivi={form.argomenti} onToggle={(a) => toggleArg("argomenti", a)} onAggiungi={() => aggiungiVoce("argomenti_corso")} />

            <h2 className="font-display font-semibold">3. Valutazione</h2>
            <div className="grid grid-cols-3 gap-2">
              {ESITI.map((e) => (
                <button key={e} type="button" onClick={() => set("esito", e)}
                  className={`rounded-lg border p-2 text-sm font-medium ${form.esito === e ? esitoClass(e) : "hover:bg-muted"}`}>{e}</button>
              ))}
            </div>
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
            <Campo label={form.esito === "Non valido" ? "Motivo del rifiuto (obbligatorio)" : "Note / motivazione"}>
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
                    <td className="p-2"><div className="font-medium">{r.cognome} {r.nome}</div><div className="font-mono text-xs text-muted-foreground">{r.codice_fiscale}</div></td>
                    <td className="p-2">{r.tipo_corso_nome || <span className="text-destructive">da scegliere</span>}<div className="text-xs text-muted-foreground">{r.ore ?? "?"} ore</div></td>
                    <td className="p-2">{formatData(r.data_corso)}</td>
                    <td className="p-2"><span className={`rounded-full border px-2 py-0.5 text-xs ${esitoClass(r.esito)}`}>{r.esito}</span>{r.integrazione && r.esito !== "Valido" && r.esito !== "Non valido" && <div className="mt-1 text-xs text-muted-foreground">{r.integrazione}</div>}</td>
                    <td className="p-2 text-xs">{r.archiviato ? <span className="text-success">Archiviato nel DB ✓</span> : "Bozza"}{r.inviato && <div className="text-primary">Email preparata</div>}</td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        <Icona t="Modifica" onClick={() => modifica(r)}><Pencil /></Icona>
                        <Icona t="Aggiungi al database" disabled={r.archiviato} onClick={() => archivia([r])}><DatabaseZap /></Icona>
                        <Icona t="Duplica" onClick={() => duplica(r)}><CopyPlus /></Icona>
                        <Icona t="Copia riepilogo" onClick={() => { navigator.clipboard.writeText(riepilogo(r)); toast.success("Copiato"); }}><Copy /></Icona>
                        <Icona t="Salva in cartella (AAAA-MM)" onClick={() => salvaLocale(r)}><FolderDown /></Icona>
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
  return "border-warning/45 bg-warning/15 text-warning-foreground";
}

function Campo({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block space-y-1 ${className}`}><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
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

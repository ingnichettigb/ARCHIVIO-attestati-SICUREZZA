import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ExternalLink, Eye, EyeOff, HelpCircle, Key, Loader2, Plus, RotateCcw, Sparkles, Trash2, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getActiveProvider, resetAiConfig, useAiConfig, type AIProvider } from "@/lib/ai-providers";
import { testaFornitoreAi } from "@/lib/ai-test.functions";

interface TemplateAiRapido {
  etichetta: string;
  nome: string;
  baseUrl: string;
  model: string;
  keyUrl: string;
  suggerimentoChiave: string;
}

const TEMPLATE_RAPIDI: TemplateAiRapido[] = [
  {
    etichetta: "⚡ Groq Vision (Gratis/Veloce)",
    nome: "Groq – Llama 3.2 Vision",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.2-11b-vision-preview",
    keyUrl: "https://console.groq.com/keys",
    suggerimentoChiave: "gsk_...",
  },
  {
    etichetta: "🌪️ Mistral Pixtral (Visione)",
    nome: "Mistral – Pixtral 12B",
    baseUrl: "https://api.mistral.ai/v1",
    model: "pixtral-12b-2409",
    keyUrl: "https://console.mistral.ai/api-keys/",
    suggerimentoChiave: "chiave Mistral",
  },
  {
    etichetta: "🌐 OpenRouter Free Vision",
    nome: "OpenRouter – Llama 3.2 Vision Free",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.2-11b-vision-instruct:free",
    keyUrl: "https://openrouter.ai/keys",
    suggerimentoChiave: "sk-or-...",
  },
];

/** Bottone "AI: …" + finestra per scegliere, aggiungere e gestire i fornitori AI. */
export function ImpostaAiButton() {
  const [config, setConfig] = useAiConfig();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<AIProvider | null>(null);
  const [chiave, setChiave] = useState("");
  const [mostra, setMostra] = useState(false);
  const [testando, setTestando] = useState<string | null>(null);

  // Stato per il dialog "Aggiungi nuova AI"
  const [openNuova, setOpenNuova] = useState(false);
  const [nuovoNome, setNuovoNome] = useState("");
  const [nuovaBaseUrl, setNuovaBaseUrl] = useState("https://api.groq.com/openai/v1");
  const [nuovoModello, setNuovoModello] = useState("");
  const [nuovaChiave, setNuovaChiave] = useState("");
  const [linkChiaveAttuale, setLinkChiaveAttuale] = useState<string | null>("https://console.groq.com/keys");
  const [mostraNuovaChiave, setMostraNuovaChiave] = useState(false);

  const attivo = getActiveProvider(config);

  function attiva(id: string) {
    setConfig({ ...config, activeId: id });
    toast.success(`AI attiva: ${config.providers.find((p) => p.id === id)?.name}`);
  }

  function salvaChiave() {
    if (!edit) return;
    const k = chiave.trim();
    setConfig({
      providers: config.providers.map((p) => (p.id === edit.id ? { ...p, apiKey: k } : p)),
      activeId: k ? edit.id : config.activeId,
    });
    toast.success(k ? "Chiave salvata in questo browser e AI attivata" : "Chiave rimossa");
    setEdit(null);
  }

  function applicaTemplate(t: TemplateAiRapido) {
    setNuovoNome(t.nome);
    setNuovaBaseUrl(t.baseUrl);
    setNuovoModello(t.model);
    setLinkChiaveAttuale(t.keyUrl);
    toast.info(`Precompilati dati per ${t.etichetta}`);
  }

  function aggiungiNuovaAi() {
    const nome = nuovoNome.trim();
    const url = nuovaBaseUrl.trim().replace(/\/+$/, "");
    const mod = nuovoModello.trim();
    const k = nuovaChiave.trim();

    if (!nome) return void toast.error("Inserisci un nome per l'AI");
    if (!url) return void toast.error("Inserisci l'indirizzo Base URL");
    if (!mod) return void toast.error("Inserisci il nome del modello");

    const id = `custom-${Date.now()}`;
    const nuova: AIProvider = {
      id,
      name: nome,
      kind: "openai",
      baseUrl: url,
      model: mod,
      apiKey: k,
      note: "Fornitore personalizzato salvato in questo browser.",
      supportaVisione: true,
      isCustom: true,
      ...(linkChiaveAttuale ? { keyUrl: linkChiaveAttuale } : {}),
    };

    setConfig({
      providers: [...config.providers, nuova],
      activeId: k ? id : config.activeId,
    });

    toast.success(`AI "${nome}" aggiunta con successo`);
    setNuovoNome("");
    setNuovoModello("");
    setNuovaChiave("");
    setOpenNuova(false);
  }

  function eliminaProvider(p: AIProvider) {
    if (!p.isCustom) return;
    if (!confirm(`Vuoi davvero eliminare l'AI "${p.name}"?`)) return;

    const nuoviProviders = config.providers.filter((item) => item.id !== p.id);
    const nuovoActiveId = config.activeId === p.id ? "lovable-default" : config.activeId;

    setConfig({
      providers: nuoviProviders,
      activeId: nuovoActiveId,
    });

    toast.info(`AI "${p.name}" eliminata`);
  }

  async function testa(p: AIProvider) {
    if (p.kind === "default") return void toast.success("L'AI integrata è sempre configurata.");
    setTestando(p.id);
    const r = await testaFornitoreAi({ data: { baseUrl: p.baseUrl, model: p.model, apiKey: p.apiKey } }).catch(
      (e: Error) => ({ ok: false, messaggio: e.message }),
    );
    setTestando(null);
    if (r.ok) toast.success(r.messaggio);
    else toast.error(r.messaggio);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Sparkles className="size-4 text-primary" />
        <span className="hidden sm:inline">AI:</span>
        <strong className="max-w-[160px] truncate">{(attivo.name.split("–")[0] ?? "").split("(")[0]?.trim()}</strong>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> Imposta AI</DialogTitle>
            <DialogDescription>
              Scegli chi legge gli attestati. Le chiavi restano solo in questo browser, non nel database.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
            <Button size="sm" onClick={() => { applicaTemplate(TEMPLATE_RAPIDI[0]!); setOpenNuova(true); }} className="gap-1.5">
              <Plus className="size-4" /> Aggiungi nuova AI
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { if (confirm("Ripristinare l'elenco iniziale? Le AI personalizzate e le chiavi inserite verranno cancellate.")) { resetAiConfig(); toast.info("Elenco ripristinato"); } }}>
              <RotateCcw className="size-3.5" /> Elenco iniziale
            </Button>
          </div>
          <div className="space-y-3 pt-1">
            {config.providers.map((p) => {
              const isActive = p.id === config.activeId;
              const hasKey = p.kind === "default" || Boolean(p.apiKey.trim());
              return (
                <div key={p.id} className={`rounded-lg border p-4 ${isActive ? "border-primary bg-primary/5" : "bg-card"}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{p.name}</span>
                        {p.isCustom && <Badge variant="secondary" className="text-[10px]">Personalizzata</Badge>}
                        {isActive ? <Badge>In uso</Badge> : (
                          <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => attiva(p.id)} disabled={!hasKey}>Usa questa</Button>
                        )}
                        {p.kind !== "default" && (hasKey
                          ? <Badge variant="outline" className="border-primary/40 text-primary"><CheckCircle2 className="size-3" /> Chiave inserita</Badge>
                          : <Badge variant="outline" className="border-destructive/40 text-destructive"><AlertTriangle className="size-3" /> Chiave mancante</Badge>)}
                      </div>
                      <p className="text-xs text-muted-foreground">{p.note}</p>
                      <p className="text-[11px] text-muted-foreground">Modello: <code className="rounded bg-muted px-1">{p.model}</code></p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {p.kind !== "default" && (
                        <Button variant="outline" size="sm" onClick={() => { setEdit(p); setChiave(p.apiKey); setMostra(false); }}>
                          <Key className="size-3.5" /> Chiave
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" disabled={testando === p.id} onClick={() => testa(p)}>
                        {testando === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                        {testando === p.id ? "Provo..." : "Testa"}
                      </Button>
                      {p.isCustom && (
                        <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => eliminaProvider(p)} title="Elimina questa AI">
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modale Inserimento/Modifica Chiave per fornitore esistente */}
      <Dialog open={Boolean(edit)} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chiave di accesso</DialogTitle>
            <DialogDescription>{edit?.name}</DialogDescription>
          </DialogHeader>
          {edit?.keyUrl && (
            <div className="rounded-md bg-muted p-3 text-xs">
              1. Apri il sito e accedi · 2. Crea la chiave · 3. Copiala e incollala qui sotto.
              <a href={edit.keyUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1 font-medium text-primary hover:underline">
                Crea la chiave <ExternalLink className="size-3" />
              </a>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="chiave-ai">Chiave</Label>
            <div className="relative">
              <Input id="chiave-ai" type={mostra ? "text" : "password"} value={chiave} onChange={(e) => setChiave(e.target.value)} placeholder="Incolla qui la chiave" className="pr-10" />
              <button type="button" onClick={() => setMostra(!mostra)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Mostra o nascondi chiave">
                {mostra ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEdit(null)}>Annulla</Button>
            <Button onClick={salvaChiave}>Salva e attiva</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modale Aggiungi Nuova AI con Aiuto alla Compilazione */}
      <Dialog open={openNuova} onOpenChange={setOpenNuova}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="size-5 text-primary" /> Aggiungi nuova AI</DialogTitle>
            <DialogDescription>
              Scegli una precompilazione rapida o inserisci manualmente i dati.
            </DialogDescription>
          </DialogHeader>

          {/* Sezione AIUTO / PRECOMPILAZIONE RAPIDA */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <HelpCircle className="size-4 text-primary" />
              <span>Precompila in 1 clic:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_RAPIDI.map((t) => (
                <Button key={t.nome} type="button" variant="outline" size="sm" className="h-7 text-xs bg-background" onClick={() => applicaTemplate(t)}>
                  {t.etichetta}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              💡 <strong>Importante:</strong> il modello scelto deve avere il supporto <em>Vision</em> per leggere testo e date dagli attestati.
            </p>
          </div>

          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="nuovo-nome">Nome visualizzato *</Label>
              <Input id="nuovo-nome" value={nuovoNome} onChange={(e) => setNuovoNome(e.target.value)} placeholder="es. Groq – Llama 3.2 Vision" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="nuova-url">Base URL API *</Label>
              <Input id="nuova-url" value={nuovaBaseUrl} onChange={(e) => setNuovaBaseUrl(e.target.value)} placeholder="https://api.groq.com/openai/v1" />
              <p className="text-[11px] text-muted-foreground">L'indirizzo compatibile OpenAI (termina tipicamente con <code>/v1</code> o <code>/openai/v1</code>)</p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="nuovo-modello">Nome Modello esatto *</Label>
              <Input id="nuovo-modello" value={nuovoModello} onChange={(e) => setNuovoModello(e.target.value)} placeholder="es. llama-3.2-11b-vision-preview" />
              <p className="text-[11px] text-muted-foreground">Il codice esatto del modello con visione (es. <code>pixtral-12b-2409</code>, <code>llama-3.2-11b-vision-preview</code>)</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="nuova-chiave">Chiave API (opzionale subito)</Label>
                {linkChiaveAttuale && (
                  <a href={linkChiaveAttuale} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                    Crea chiave gratis <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <div className="relative">
                <Input id="nuova-chiave" type={mostraNuovaChiave ? "text" : "password"} value={nuovaChiave} onChange={(e) => setNuovaChiave(e.target.value)} placeholder="Incolla qui la chiave (es. gsk_...)" className="pr-10" />
                <button type="button" onClick={() => setMostraNuovaChiave(!mostraNuovaChiave)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Mostra o nascondi chiave">
                  {mostraNuovaChiave ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpenNuova(false)}>Annulla</Button>
            <Button onClick={aggiungiNuovaAi}>Salva AI</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

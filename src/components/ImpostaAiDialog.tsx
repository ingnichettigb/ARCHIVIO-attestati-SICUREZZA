import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ExternalLink, Eye, EyeOff, Key, Loader2, RotateCcw, Sparkles, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getActiveProvider, resetAiConfig, useAiConfig, type AIProvider } from "@/lib/ai-providers";
import { testaFornitoreAi } from "@/lib/ai-test.functions";

/** Bottone "AI: …" + finestra per scegliere il fornitore AI e inserire le chiavi (salvate solo nel browser). */
export function ImpostaAiButton() {
  const [config, setConfig] = useAiConfig();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<AIProvider | null>(null);
  const [chiave, setChiave] = useState("");
  const [mostra, setMostra] = useState(false);
  const [testando, setTestando] = useState<string | null>(null);
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
        <strong className="max-w-[160px] truncate">{attivo.name.split("–")[0].split("(")[0].trim()}</strong>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> Imposta AI</DialogTitle>
            <DialogDescription>
              Scegli chi legge gli attestati. Le chiavi restano solo in questo browser, non nel database.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => { if (confirm("Ripristinare l'elenco iniziale? Le chiavi inserite verranno cancellate.")) { resetAiConfig(); toast.info("Elenco ripristinato"); } }}>
              <RotateCcw className="size-3.5" /> Elenco iniziale
            </Button>
          </div>
          <div className="space-y-3">
            {config.providers.map((p) => {
              const isActive = p.id === config.activeId;
              const hasKey = p.kind === "default" || Boolean(p.apiKey.trim());
              return (
                <div key={p.id} className={`rounded-lg border p-4 ${isActive ? "border-primary bg-primary/5" : "bg-card"}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{p.name}</span>
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
                    <div className="flex shrink-0 gap-2">
                      {p.kind !== "default" && (
                        <Button variant="outline" size="sm" onClick={() => { setEdit(p); setChiave(p.apiKey); setMostra(false); }}>
                          <Key className="size-3.5" /> Chiave
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" disabled={testando === p.id} onClick={() => testa(p)}>
                        {testando === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                        {testando === p.id ? "Provo..." : "Testa"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  );
}

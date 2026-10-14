import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  caricaDocumento,
  cartellaDipendente,
  eliminaDocumento,
  formatData,
  getDocumenti,
  nomeFilePdf,
  salvaInLocale,
  scadenzaBadgeClass,
  statoScadenza,
  supportaCartellaLocale,
  TIPI_ATTESTATO_PDF,
  urlDocumento,
  type Dipendente,
  type DocumentoAttestato,
} from "@/lib/api";

export function DocumentiAttestati({ dipendente }: { dipendente: Dipendente }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: documenti = [], isLoading } = useQuery({
    queryKey: ["documenti", dipendente.id],
    queryFn: () => getDocumenti(dipendente.id),
  });

  async function apri(doc: DocumentoAttestato) {
    try {
      const url = await urlDocumento(doc.percorso_file);
      if (url) window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error("Impossibile aprire il file", { description: (e as Error).message });
    }
  }

  async function elimina(doc: DocumentoAttestato) {
    if (!window.confirm(`Eliminare definitivamente "${doc.nome_file}"?`)) return;
    try {
      await eliminaDocumento(doc);
      toast.success("Attestato eliminato");
      qc.invalidateQueries({ queryKey: ["documenti", dipendente.id] });
    } catch (e) {
      toast.error("Eliminazione non riuscita", { description: (e as Error).message });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Attestati (PDF)</h3>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Aggiungi attestato
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Caricamento…
        </div>
      ) : documenti.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {documenti.map((doc) => {
            const stato = statoScadenza(doc.data_scadenza);
            return (
              <li key={doc.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <FileText className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{doc.nome_file}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.tipo_personalizzato || doc.tipo_attestato}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${scadenzaBadgeClass(stato)}`}
                >
                  {formatData(doc.data_scadenza)}
                </span>
                <Button variant="ghost" size="icon" onClick={() => apri(doc)} aria-label="Apri PDF">
                  <Download className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => elimina(doc)}
                  aria-label="Elimina PDF"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          Nessun PDF caricato per questo dipendente
        </p>
      )}

      <DialogCaricamento
        dipendente={dipendente}
        open={open}
        onOpenChange={setOpen}
        onDone={() => qc.invalidateQueries({ queryKey: ["documenti", dipendente.id] })}
      />
    </div>
  );
}

function DialogCaricamento({
  dipendente,
  open,
  onOpenChange,
  onDone,
}: {
  dipendente: Dipendente;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState("");
  const [altro, setAltro] = useState("");
  const [dataCorso, setDataCorso] = useState("");
  const [scadenza, setScadenza] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [anteprima, setAnteprima] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [anchLocale, setAnchLocale] = useState(false);

  useEffect(() => {
    if (!file) {
      setAnteprima(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setAnteprima(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!open) {
      setTipo("");
      setAltro("");
      setDataCorso("");
      setScadenza("");
      setFile(null);
      setDrag(false);
    }
  }, [open]);

  const etichetta = tipo === "Altro" ? altro.trim() : tipo;
  const nomeFinale = useMemo(() => {
    if (!etichetta || !dataCorso || !scadenza || !file) return null;
    return nomeFilePdf(dipendente.cognome, dipendente.nome, etichetta, dataCorso, dipendente.codice_fiscale);
  }, [etichetta, dataCorso, scadenza, file, dipendente]);

  function accetta(f: File | null | undefined) {
    if (!f) return;
    const ok = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!ok) {
      toast.error("Sono ammessi solo file PDF");
      return;
    }
    setFile(f);
  }

  async function conferma() {
    if (!nomeFinale || !file) return;
    setBusy(true);
    try {
      await caricaDocumento({
        dipendente,
        tipo,
        tipoPersonalizzato: tipo === "Altro" ? altro.trim() : null,
        dataCorso,
        dataScadenza: scadenza,
        file,
      });
      if (anchLocale) {
        if (!supportaCartellaLocale()) {
          toast.info("Salvataggio locale non supportato", {
            description:
              "La copia in cartella locale funziona solo su Chrome o Edge da computer. Il file è stato salvato online.",
          });
        } else {
          try {
            const scritto = await salvaInLocale(
              file,
              nomeFinale,
              cartellaDipendente(dipendente),
            );
            if (scritto) toast.success("Copia salvata anche nella cartella locale");
          } catch (e) {
            if ((e as DOMException)?.name !== "AbortError")
              toast.error("Copia locale non riuscita", {
                description: (e as Error).message,
              });
          }
        }
      }
      toast.success("Attestato caricato", { description: nomeFinale });
      onDone();
      onOpenChange(false);
    } catch (e) {
      toast.error("Caricamento non riuscito", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aggiungi attestato PDF</DialogTitle>
          <DialogDescription>
            {dipendente.cognome} {dipendente.nome} · {dipendente.codice_fiscale}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tipo di attestato</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona…" />
                </SelectTrigger>
                <SelectContent>
                  {TIPI_ATTESTATO_PDF.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data rilascio / emanazione</Label>
              <Input
                type="date"
                value={dataCorso}
                onChange={(e) => setDataCorso(e.target.value)}
              />
              <span className="text-[11px] text-muted-foreground">
                Anno/mese usati per il nome del file
              </span>
            </div>
            <div className="space-y-1.5">
              <Label>Data di scadenza</Label>
              <Input
                type="date"
                value={scadenza}
                onChange={(e) => setScadenza(e.target.value)}
              />
              <span className="text-[11px] text-muted-foreground">
                Per il calcolo dei rinnovi
              </span>
            </div>
            {tipo === "Altro" && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Specifica il tipo</Label>
                <Input
                  value={altro}
                  onChange={(e) => setAltro(e.target.value)}
                  placeholder="Es. Lavori in quota"
                />
              </div>
            )}
          </div>

          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              accetta(e.dataTransfer.files?.[0]);
            }}
            className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors ${
              drag ? "border-primary bg-accent/50" : "border-border bg-surface"
            }`}
          >
            <Upload className="size-6 text-primary" />
            {file ? (
              <span className="font-medium">{file.name}</span>
            ) : (
              <span className="text-muted-foreground">
                Trascina qui il PDF oppure clicca per sceglierlo
              </span>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => accetta(e.target.files?.[0])}
          />

          {nomeFinale && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              Il file verrà salvato come{" "}
              <span className="font-medium break-all">{nomeFinale}</span>
            </p>
          )}

          {anteprima && (
            <object
              data={anteprima}
              type="application/pdf"
              className="h-80 w-full rounded-lg border border-border"
            >
              <p className="p-4 text-sm text-muted-foreground">
                Anteprima non disponibile in questo browser.
              </p>
            </object>
          )}

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={anchLocale}
              onChange={(e) => setAnchLocale(e.target.checked)}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            Salva anche in locale (cartella "Archivio Attestati Sicurezza", solo
            Chrome/Edge da computer)
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Annulla
          </Button>
          <Button onClick={conferma} disabled={!nomeFinale || busy}>
            {busy && <Loader2 className="size-4 animate-spin" />} Conferma e carica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

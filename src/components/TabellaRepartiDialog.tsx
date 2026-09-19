import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Table2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  aggiornaReparto,
  aggiungiReparto,
  eliminaReparto,
  getReparti,
  type Reparto,
} from "@/lib/api";

const VUOTA = { nome: "", ordine: "", attivo: true, richiede_classe_concorso: false };

/**
 * Bottone che apre la tabella "reparti" in visione e modifica diretta:
 * ogni cella si modifica sul posto, si può inserire una riga nuova o
 * cancellarne una. Pensato per chi vuole vedere/correggere tutto insieme
 * invece di passare dalla scheda a interruttori del tab "Reparti".
 */
export function TabellaRepartiDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Table2 className="size-4" /> Tabella reparti
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tabella reparti</DialogTitle>
            <DialogDescription>
              Visione e modifica diretta di tutti i reparti: cambia un campo e si salva da solo,
              elimina una riga con il cestino o aggiungine una nuova in fondo.
            </DialogDescription>
          </DialogHeader>
          <TabellaReparti />
        </DialogContent>
      </Dialog>
    </>
  );
}

function TabellaReparti() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [nuova, setNuova] = useState(VUOTA);

  const {
    data: reparti = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["reparti"],
    queryFn: getReparti,
    retry: false,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["reparti"] });
  }

  async function salvaCampo<K extends keyof Reparto>(r: Reparto, campo: K, valore: Reparto[K]) {
    if (r[campo] === valore) return;
    setBusy(r.id);
    try {
      await aggiornaReparto(r.id, { [campo]: valore } as Partial<Reparto>);
      refresh();
    } catch (e) {
      toast.error("Modifica non riuscita", { description: (e as Error).message });
      refresh(); // ripristina il valore mostrato in tabella
    } finally {
      setBusy(null);
    }
  }

  async function rimuovi(r: Reparto) {
    if (!window.confirm(`Eliminare definitivamente "${r.nome}" dalla tabella reparti?`)) return;
    setBusy(r.id);
    try {
      await eliminaReparto(r.id);
      refresh();
    } catch (e) {
      toast.error("Eliminazione non riuscita", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function inserisci() {
    if (!nuova.nome.trim()) return;
    setBusy("nuova");
    try {
      const ordine = nuova.ordine.trim()
        ? Number(nuova.ordine)
        : reparti.reduce((m, r) => Math.max(m, r.ordine), 0) + 1;
      await aggiungiReparto(nuova.nome, ordine);
      // attivo/richiede_classe_concorso non passano da aggiungiReparto: si sistemano dopo, se diversi dal default
      setNuova(VUOTA);
      refresh();
    } catch (e) {
      toast.error("Riga non inserita", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <p className="font-medium">Impossibile leggere la tabella</p>
        <p className="mt-1 text-xs">{(error as Error).message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Caricamento…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">Nome</TableHead>
              <TableHead className="w-20">Ordine</TableHead>
              <TableHead className="w-28 text-center">Nel modulo</TableHead>
              <TableHead className="w-36 text-center">Classe/materia</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {reparti.map((r) => (
              <TableRow key={r.id} className={busy === r.id ? "opacity-60" : ""}>
                <TableCell className="p-1.5">
                  <Input
                    defaultValue={r.nome}
                    disabled={busy === r.id}
                    onBlur={(e) => salvaCampo(r, "nome", e.target.value.trim())}
                    className="h-9"
                  />
                </TableCell>
                <TableCell className="p-1.5">
                  <Input
                    type="number"
                    defaultValue={r.ordine}
                    disabled={busy === r.id}
                    onBlur={(e) => salvaCampo(r, "ordine", Number(e.target.value) || 0)}
                    className="h-9"
                  />
                </TableCell>
                <TableCell className="p-1.5 text-center">
                  <Switch
                    checked={r.attivo}
                    disabled={busy === r.id}
                    onCheckedChange={(v) => salvaCampo(r, "attivo", v)}
                  />
                </TableCell>
                <TableCell className="p-1.5 text-center">
                  <Switch
                    checked={r.richiede_classe_concorso}
                    disabled={busy === r.id}
                    onCheckedChange={(v) => salvaCampo(r, "richiede_classe_concorso", v)}
                  />
                </TableCell>
                <TableCell className="p-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy === r.id}
                    onClick={() => rimuovi(r)}
                    aria-label={`Elimina ${r.nome}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!reparti.length && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  Nessun reparto in tabella.
                </TableCell>
              </TableRow>
            )}

            <TableRow>
              <TableCell className="p-1.5">
                <Input
                  value={nuova.nome}
                  onChange={(e) => setNuova((n) => ({ ...n, nome: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") inserisci();
                  }}
                  placeholder="Nuovo reparto…"
                  className="h-9"
                />
              </TableCell>
              <TableCell className="p-1.5">
                <Input
                  type="number"
                  value={nuova.ordine}
                  onChange={(e) => setNuova((n) => ({ ...n, ordine: e.target.value }))}
                  placeholder="auto"
                  className="h-9"
                />
              </TableCell>
              <TableCell colSpan={2} />
              <TableCell className="p-1.5">
                <Button
                  size="icon"
                  variant="outline"
                  disabled={!nuova.nome.trim() || busy === "nuova"}
                  onClick={inserisci}
                  aria-label="Aggiungi reparto"
                >
                  {busy === "nuova" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        "Nel modulo" nasconde/mostra il reparto al lavoratore. "Classe/materia" chiede classe di
        concorso e materia a chi sceglie questo reparto (di solito solo Docente).
      </p>
    </div>
  );
}

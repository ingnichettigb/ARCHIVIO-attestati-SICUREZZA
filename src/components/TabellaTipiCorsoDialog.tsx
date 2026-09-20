import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GripVertical, ListChecks, Loader2, Plus, Trash2 } from "lucide-react";
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
  aggiornaTipoCorso,
  aggiungiTipoCorso,
  eliminaTipoCorso,
  getTipiCorso,
  riordinaTipiCorso,
  type TipoCorso,
} from "@/lib/api";

const VUOTO = { nome_corso: "", macro_categoria: "", livello_specifico: "Base" };

/**
 * Bottone che apre la tabella completa dei tipi di corso: codice ufficiale,
 * ore, validità e corso di aggiornamento collegato. Ogni cella si modifica
 * sul posto, le righe si trascinano per cambiare ordine (o si spostano con
 * le frecce), si può cancellare o aggiungerne una nuova, e ogni corso ha un
 * interruttore per farlo vedere o no a chi carica gli attestati.
 */
export function TabellaTipiCorsoDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ListChecks className="size-4" /> Tabella corsi
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Tabella tipi di corso</DialogTitle>
            <DialogDescription>
              Codici ufficiali Stato-Regioni: ore, validità e corso di aggiornamento collegato.
              Trascina una riga dal simbolo a sinistra per cambiarne l'ordine, modifica una cella
              scrivendoci sopra, elimina con il cestino o aggiungine una in fondo.
            </DialogDescription>
          </DialogHeader>
          <TabellaTipiCorso />
        </DialogContent>
      </Dialog>
    </>
  );
}

function TabellaTipiCorso() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [nuovo, setNuovo] = useState(VUOTO);
  const trascinata = useRef<string | null>(null);
  const [sopra, setSopra] = useState<string | null>(null);

  const {
    data: corsi = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tipi_corso"],
    queryFn: getTipiCorso,
    retry: false,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["tipi_corso"] });
    qc.invalidateQueries({ queryKey: ["categorie_corso"] });
  }

  async function salvaCampo<K extends keyof TipoCorso>(
    c: TipoCorso,
    campo: K,
    valore: TipoCorso[K],
  ) {
    if (c[campo] === valore) return;
    setBusy(c.id);
    try {
      await aggiornaTipoCorso(c.id, { [campo]: valore } as Partial<TipoCorso>);
      refresh();
    } catch (e) {
      toast.error("Modifica non riuscita", { description: (e as Error).message });
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function rimuovi(c: TipoCorso) {
    if (!window.confirm(`Eliminare definitivamente "${c.nome_corso}" dalla tabella corsi?`)) return;
    setBusy(c.id);
    try {
      await eliminaTipoCorso(c.id);
      refresh();
    } catch (e) {
      toast.error("Eliminazione non riuscita", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function inserisci() {
    if (!nuovo.nome_corso.trim()) return;
    setBusy("nuovo");
    try {
      const ordine = corsi.reduce((m, c) => Math.max(m, c.ordine), 0) + 1;
      await aggiungiTipoCorso({ ...nuovo, ordine });
      setNuovo(VUOTO);
      refresh();
    } catch (e) {
      toast.error("Corso non aggiunto", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  // Sposta un corso di una posizione su/giù: comodo su mobile dove trascinare è scomodo.
  async function sposta(index: number, direzione: -1 | 1) {
    const dest = index + direzione;
    if (dest < 0 || dest >= corsi.length) return;
    const nuovoOrdine = [...corsi];
    const a = nuovoOrdine[index];
    const b = nuovoOrdine[dest];
    if (!a || !b) return;
    nuovoOrdine[index] = b;
    nuovoOrdine[dest] = a;
    setBusy(a.id);
    try {
      await riordinaTipiCorso(nuovoOrdine.map((c) => c.id));
      refresh();
    } catch (e) {
      toast.error("Spostamento non riuscito", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function rilasciaSu(idDestinazione: string) {
    const idOrigine = trascinata.current;
    trascinata.current = null;
    setSopra(null);
    if (!idOrigine || idOrigine === idDestinazione) return;
    const attuale = corsi.map((c) => c.id);
    const daIdx = attuale.indexOf(idOrigine);
    const aIdx = attuale.indexOf(idDestinazione);
    if (daIdx === -1 || aIdx === -1) return;
    const riordinati = [...attuale];
    riordinati.splice(daIdx, 1);
    riordinati.splice(aIdx, 0, idOrigine);
    setBusy(idOrigine);
    try {
      await riordinaTipiCorso(riordinati);
      refresh();
    } catch (e) {
      toast.error("Spostamento non riuscito", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        <p className="font-medium">Impossibile leggere la tabella</p>
        <p className="mt-1 text-xs">
          Se hai appena aggiornato l'app, esegui prima la migrazione SQL{" "}
          <code>20260919160000_tipi_corso_stato_regioni.sql</code>. Dettaglio:{" "}
          {(error as Error).message}
        </p>
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
              <TableHead className="w-8" />
              <TableHead className="w-24">Codice</TableHead>
              <TableHead className="min-w-[220px]">Corso</TableHead>
              <TableHead className="w-24">Ore corso</TableHead>
              <TableHead className="w-28">Validità (anni)</TableHead>
              <TableHead className="w-28">Aggiorn. (anni)</TableHead>
              <TableHead className="w-24">Aggiorn. (ore)</TableHead>
              <TableHead className="w-32">Codice aggiorn.</TableHead>
              <TableHead className="w-24 text-center">Al lavoratore</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {corsi.map((c, i) => (
              <TableRow
                key={c.id}
                className={`${busy === c.id ? "opacity-60" : ""} ${sopra === c.id ? "bg-accent/40" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (sopra !== c.id) setSopra(c.id);
                }}
                onDragLeave={() => setSopra((s) => (s === c.id ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  rilasciaSu(c.id);
                }}
              >
                <TableCell className="p-1.5">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      draggable
                      onDragStart={() => {
                        trascinata.current = c.id;
                      }}
                      onDragEnd={() => {
                        trascinata.current = null;
                        setSopra(null);
                      }}
                      className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
                      aria-label={`Trascina per spostare ${c.nome_corso}`}
                      title="Trascina per riordinare"
                    >
                      <GripVertical className="size-4" />
                    </button>
                    <div className="flex flex-col">
                      <button
                        type="button"
                        disabled={i === 0 || busy === c.id}
                        onClick={() => sposta(i, -1)}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                        aria-label={`Sposta su ${c.nome_corso}`}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={i === corsi.length - 1 || busy === c.id}
                        onClick={() => sposta(i, 1)}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                        aria-label={`Sposta giù ${c.nome_corso}`}
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="p-1.5">
                  <Input
                    defaultValue={c.codice ?? ""}
                    disabled={busy === c.id}
                    onBlur={(e) => salvaCampo(c, "codice", e.target.value.trim() || null)}
                    className="h-9 font-mono text-xs"
                  />
                </TableCell>
                <TableCell className="p-1.5">
                  <Input
                    defaultValue={c.nome_corso}
                    disabled={busy === c.id}
                    onBlur={(e) => salvaCampo(c, "nome_corso", e.target.value.trim())}
                    className="h-9"
                  />
                  <span className="pl-1 text-xs text-muted-foreground">
                    {c.macro_categoria} · {c.livello_specifico}
                  </span>
                </TableCell>
                <TableCell className="p-1.5">
                  <Input
                    type="number"
                    defaultValue={c.ore_minime_legge ?? ""}
                    disabled={busy === c.id}
                    onBlur={(e) =>
                      salvaCampo(
                        c,
                        "ore_minime_legge",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className="h-9"
                  />
                </TableCell>
                <TableCell className="p-1.5">
                  <Input
                    type="number"
                    defaultValue={c.durata_validita_anni ?? ""}
                    placeholder="non scade"
                    disabled={busy === c.id}
                    onBlur={(e) =>
                      salvaCampo(
                        c,
                        "durata_validita_anni",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className="h-9"
                  />
                </TableCell>
                <TableCell className="p-1.5">
                  <Input
                    type="number"
                    defaultValue={c.anni_aggiornamento ?? ""}
                    placeholder="—"
                    disabled={busy === c.id}
                    onBlur={(e) =>
                      salvaCampo(
                        c,
                        "anni_aggiornamento",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className="h-9"
                  />
                </TableCell>
                <TableCell className="p-1.5">
                  <Input
                    type="number"
                    defaultValue={c.ore_aggiornamento ?? ""}
                    placeholder="—"
                    disabled={busy === c.id}
                    onBlur={(e) =>
                      salvaCampo(
                        c,
                        "ore_aggiornamento",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    className="h-9"
                  />
                </TableCell>
                <TableCell className="p-1.5">
                  <Input
                    defaultValue={c.codice_corso_aggiornamento ?? ""}
                    placeholder="—"
                    disabled={busy === c.id}
                    onBlur={(e) =>
                      salvaCampo(c, "codice_corso_aggiornamento", e.target.value.trim() || null)
                    }
                    className="h-9 font-mono text-xs"
                  />
                </TableCell>
                <TableCell className="p-1.5 text-center">
                  <Switch
                    checked={c.visibile_lavoratore}
                    disabled={busy === c.id}
                    onCheckedChange={(v) => salvaCampo(c, "visibile_lavoratore", v)}
                    aria-label={`Mostra ${c.nome_corso} a chi carica l'attestato`}
                  />
                </TableCell>
                <TableCell className="p-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={busy === c.id}
                    onClick={() => rimuovi(c)}
                    aria-label={`Elimina ${c.nome_corso}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!corsi.length && (
              <TableRow>
                <TableCell colSpan={10} className="py-6 text-center text-sm text-muted-foreground">
                  Nessun corso in tabella.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          value={nuovo.nome_corso}
          onChange={(e) => setNuovo((n) => ({ ...n, nome_corso: e.target.value }))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && nuovo.nome_corso.trim()) inserisci();
          }}
          placeholder="Nome del nuovo corso"
          className="min-w-[220px] flex-1"
        />
        <Input
          value={nuovo.macro_categoria}
          onChange={(e) => setNuovo((n) => ({ ...n, macro_categoria: e.target.value }))}
          placeholder="Categoria (es. Antincendio)"
          className="w-48"
        />
        <Button onClick={inserisci} disabled={!nuovo.nome_corso.trim() || busy === "nuovo"}>
          {busy === "nuovo" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Aggiungi corso
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        "Al lavoratore" mostra o nasconde questo corso specifico nel modulo di invio: utile se un
        reparto può inviare solo certi tipi di attestato. Resta comunque visibile in dashboard HR e
        nella scheda dei dipendenti. Il cestino non funziona se il corso è già usato in qualche
        attestato caricato: in quel caso nascondilo con l'interruttore invece di eliminarlo.
      </p>
    </div>
  );
}

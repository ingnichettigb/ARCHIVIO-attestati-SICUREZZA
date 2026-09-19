import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  aggiungiReparto,
  eliminaReparto,
  getCategorieCorso,
  getDipendenti,
  getReparti,
  impostaCategoriaVisibile,
  impostaRepartoAttivo,
} from "@/lib/api";

/** Bottone "Impostazioni" + finestra per gestire reparti e categorie di corso. */
export function ImpostazioniDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings className="size-4" /> Impostazioni
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Impostazioni modulo lavoratore</DialogTitle>
            <DialogDescription>
              Scegli cosa vede il lavoratore quando compila il modulo. Valgono per tutti allo stesso
              modo.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="reparti">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="reparti">Reparti</TabsTrigger>
              <TabsTrigger value="categorie">Categorie corsi</TabsTrigger>
            </TabsList>
            <TabsContent value="reparti" className="mt-4">
              <RepartiTab />
            </TabsContent>
            <TabsContent value="categorie" className="mt-4">
              <CategorieTab />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ErroreTabelle({ messaggio }: { messaggio: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <p className="font-medium">Impossibile leggere i dati</p>
      <p className="mt-1 text-xs">
        Se hai appena aggiornato l'app, esegui prima la migrazione SQL (file{" "}
        <code>20260919120000_reparti_e_categorie_corso.sql</code>). Dettaglio: {messaggio}
      </p>
    </div>
  );
}

/* ----------------------------- REPARTI ----------------------------- */

function RepartiTab() {
  const qc = useQueryClient();
  const [nuovo, setNuovo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const {
    data: reparti = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["reparti"],
    queryFn: getReparti,
    retry: false,
  });
  const { data: dipendenti = [] } = useQuery({
    queryKey: ["dipendenti"],
    queryFn: getDipendenti,
  });

  // Valori di "reparto" già scritti a mano nei dipendenti ma non ancora in elenco.
  const daImportare = useMemo(() => {
    const presenti = new Set(reparti.map((r) => r.nome.trim().toLowerCase()));
    const visti = new Map<string, string>();
    for (const d of dipendenti) {
      const v = (d.reparto ?? "").trim();
      if (!v || v.length > 40 || /^\d/.test(v)) continue; // salta vuoti e date importate male
      const k = v.toLowerCase();
      if (!presenti.has(k) && !visti.has(k)) visti.set(k, v);
    }
    return Array.from(visti.values())
      .sort((a, b) => a.localeCompare(b, "it"))
      .slice(0, 30);
  }, [dipendenti, reparti]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ["reparti"] });
  }

  async function aggiungi(nome: string) {
    const ordine = reparti.reduce((m, r) => Math.max(m, r.ordine), 0) + 1;
    setBusy("nuovo");
    try {
      await aggiungiReparto(nome, ordine);
      setNuovo("");
      refresh();
    } catch (e) {
      toast.error("Reparto non aggiunto", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function cambiaAttivo(id: string, attivo: boolean) {
    setBusy(id);
    try {
      await impostaRepartoAttivo(id, attivo);
      refresh();
    } catch (e) {
      toast.error("Modifica non riuscita", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function rimuovi(id: string, nome: string) {
    if (
      !window.confirm(
        `Togliere "${nome}" dall'elenco? I dipendenti che l'hanno già scelto lo mantengono.`,
      )
    )
      return;
    setBusy(id);
    try {
      await eliminaReparto(id);
      refresh();
    } catch (e) {
      toast.error("Eliminazione non riuscita", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErroreTabelle messaggio={(error as Error).message} />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Il lavoratore sceglie il proprio reparto da questo elenco. Puoi aggiungere quello che vuoi e
        nascondere le voci che non servono.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Caricamento…
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {reparti.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className={`flex-1 font-medium ${r.attivo ? "" : "text-muted-foreground"}`}>
                {r.nome}
              </span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {r.attivo ? "Nel modulo" : "Nascosto"}
                <Switch
                  checked={r.attivo}
                  disabled={busy === r.id}
                  onCheckedChange={(v) => cambiaAttivo(r.id, v)}
                />
              </label>
              <Button
                variant="ghost"
                size="icon"
                disabled={busy === r.id}
                onClick={() => rimuovi(r.id, r.nome)}
                aria-label={`Elimina ${r.nome}`}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
          {!reparti.length && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nessun reparto. Aggiungine uno qui sotto.
            </li>
          )}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={nuovo}
          onChange={(e) => setNuovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && nuovo.trim()) aggiungi(nuovo);
          }}
          placeholder="Nuovo reparto, es. Collaboratore"
        />
        <Button onClick={() => aggiungi(nuovo)} disabled={!nuovo.trim() || busy === "nuovo"}>
          {busy === "nuovo" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Aggiungi
        </Button>
      </div>

      {daImportare.length > 0 && (
        <div className="space-y-2 rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">
            Già presenti nei dipendenti ma non nell'elenco. Tocca per aggiungerli:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {daImportare.map((v) => (
              <button
                key={v}
                onClick={() => aggiungi(v)}
                className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs hover:bg-accent/40"
              >
                + {v}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- CATEGORIE CORSI ------------------------- */

function CategorieTab() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const {
    data: categorie = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["categorie_corso"],
    queryFn: getCategorieCorso,
    retry: false,
  });

  async function cambia(nome: string, visibile: boolean) {
    setBusy(nome);
    try {
      await impostaCategoriaVisibile(nome, visibile);
      qc.invalidateQueries({ queryKey: ["categorie_corso"] });
      qc.invalidateQueries({ queryKey: ["categorie_nascoste"] });
    } catch (e) {
      toast.error("Modifica non riuscita", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErroreTabelle messaggio={(error as Error).message} />;

  const visibili = categorie.filter((c) => c.visibile_lavoratore).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Elenco di tutte le categorie di corso, uguale per tutti. Attiva quelle che il lavoratore può
        scegliere nel modulo: le altre restano comunque visibili in dashboard HR e nelle schede dei
        dipendenti.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Caricamento…
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {categorie.map((c) => (
              <li key={c.macro_categoria} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1">
                  <span
                    className={`font-medium ${c.visibile_lavoratore ? "" : "text-muted-foreground"}`}
                  >
                    {c.macro_categoria}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {c.corsi} {c.corsi === 1 ? "corso" : "corsi"}
                  </span>
                </span>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {c.visibile_lavoratore ? "Nel modulo" : "Nascosta"}
                  <Switch
                    checked={c.visibile_lavoratore}
                    disabled={busy === c.macro_categoria}
                    onCheckedChange={(v) => cambia(c.macro_categoria, v)}
                  />
                </label>
              </li>
            ))}
            {!categorie.length && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nessun corso in archivio.
              </li>
            )}
          </ul>
          {categorie.length > 0 && visibili === 0 && (
            <p className="text-xs text-destructive">
              Attenzione: con tutte le categorie nascoste il lavoratore non potrà scegliere nessun
              corso.
            </p>
          )}
        </>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Loader2,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RuoliTab } from "@/components/RuoliTab";
import { TabellaRepartiDialog } from "@/components/TabellaRepartiDialog";
import { TabellaTipiCorsoDialog } from "@/components/TabellaTipiCorsoDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  aggiungiClasseConcorso,
  aggiungiReparto,
  aggiungiSottoreparto,
  eliminaClasseConcorso,
  eliminaMateria,
  eliminaReparto,
  eliminaSottoreparto,
  getCategorieCorso,
  getClassiConcorso,
  getDipendenti,
  getMaterie,
  getReparti,
  getSottoreparti,
  impostaCategoriaVisibile,
  impostaClasseAttiva,
  impostaRepartoAttivo,
  impostaRepartoClasseConcorso,
  impostaSottorepartoAttivo,
  type Sottoreparto,
} from "@/lib/api";

/** Bottone "Impostazioni" + finestra per gestire reparti, sottoreparti e categorie. */
export function ImpostazioniDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings className="size-4" /> Impostazioni
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Impostazioni modulo lavoratore</DialogTitle>
            <DialogDescription>
              Scegli cosa vede il lavoratore quando compila il modulo. Valgono per tutti allo stesso
              modo.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="reparti">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="reparti">Reparti</TabsTrigger>
              <TabsTrigger value="insegnamento">Classi e materie</TabsTrigger>
              <TabsTrigger value="categorie">Categorie corsi</TabsTrigger>
              <TabsTrigger value="ruoli">Ruoli</TabsTrigger>
            </TabsList>
            <TabsContent value="reparti" className="mt-4">
              <RepartiTab />
            </TabsContent>
            <TabsContent value="insegnamento" className="mt-4">
              <InsegnamentoTab />
            </TabsContent>
            <TabsContent value="categorie" className="mt-4">
              <CategorieTab />
            </TabsContent>
            <TabsContent value="ruoli" className="mt-4">
              <RuoliTab />
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
        Se hai appena aggiornato l'app, esegui prima le migrazioni SQL (file{" "}
        <code>20260919120000_reparti_e_categorie_corso.sql</code> e{" "}
        <code>20260919140000_sottoreparti_classi_concorso.sql</code>). Dettaglio: {messaggio}
      </p>
    </div>
  );
}

/* ----------------------------- REPARTI ----------------------------- */

function RepartiTab() {
  const qc = useQueryClient();
  const [nuovo, setNuovo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [aperti, setAperti] = useState<Set<string>>(new Set());

  const {
    data: reparti = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["reparti"],
    queryFn: getReparti,
    retry: false,
  });
  const { data: sottoreparti = [] } = useQuery({
    queryKey: ["sottoreparti"],
    queryFn: getSottoreparti,
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
    qc.invalidateQueries({ queryKey: ["sottoreparti"] });
  }

  function apriChiudi(id: string) {
    setAperti((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
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

  async function cambiaClasse(id: string, richiede: boolean) {
    setBusy(id);
    try {
      await impostaRepartoClasseConcorso(id, richiede);
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex-1 text-sm text-muted-foreground">
          Il lavoratore sceglie il proprio reparto da questo elenco. Apri un reparto per gestire i
          sottoreparti (es. ATA → AA, AT, CS, DSGA) e per decidere se chiedere classe di concorso e
          materia.
        </p>
        <TabellaRepartiDialog />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Caricamento…
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {reparti.map((r) => {
            const figli = sottoreparti.filter((s) => s.reparto_id === r.id);
            const aperto = aperti.has(r.id);
            return (
              <li key={r.id}>
                <div className="flex items-center gap-2 px-3 py-2 text-sm">
                  <button
                    type="button"
                    onClick={() => apriChiudi(r.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    aria-expanded={aperto}
                  >
                    {aperto ? (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0">
                      <span className={`font-medium ${r.attivo ? "" : "text-muted-foreground"}`}>
                        {r.nome}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {figli.length
                          ? `${figli.length} ${figli.length === 1 ? "sottoreparto" : "sottoreparti"}`
                          : "nessun sottoreparto"}
                        {r.richiede_classe_concorso ? " · classe di concorso richiesta" : ""}
                      </span>
                    </span>
                  </button>
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
                </div>

                {aperto && (
                  <div className="space-y-3 border-t border-border bg-muted/30 px-3 py-3">
                    <label className="flex items-start gap-3 rounded-lg bg-surface px-3 py-2.5 text-sm">
                      <GraduationCap className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1">
                        Chiedi classe di concorso e materia
                        <span className="block text-xs text-muted-foreground">
                          Da attivare per i docenti: i valori inseriti alimentano l'elenco dei
                          suggerimenti.
                        </span>
                      </span>
                      <Switch
                        checked={!!r.richiede_classe_concorso}
                        disabled={busy === r.id}
                        onCheckedChange={(v) => cambiaClasse(r.id, v)}
                      />
                    </label>
                    <SottorepartiBox repartoId={r.id} figli={figli} onChanged={refresh} />
                  </div>
                )}
              </li>
            );
          })}
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

/* --------------------------- SOTTOREPARTI --------------------------- */

function SottorepartiBox({
  repartoId,
  figli,
  onChanged,
}: {
  repartoId: string;
  figli: Sottoreparto[];
  onChanged: () => void;
}) {
  const [codice, setCodice] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function aggiungi() {
    const ordine = figli.reduce((m, s) => Math.max(m, s.ordine), 0) + 1;
    setBusy("nuovo");
    try {
      await aggiungiSottoreparto({ reparto_id: repartoId, nome, codice, ordine });
      setNome("");
      setCodice("");
      onChanged();
    } catch (e) {
      toast.error("Sottoreparto non aggiunto", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function cambiaAttivo(id: string, attivo: boolean) {
    setBusy(id);
    try {
      await impostaSottorepartoAttivo(id, attivo);
      onChanged();
    } catch (e) {
      toast.error("Modifica non riuscita", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function rimuovi(id: string, etichetta: string) {
    if (!window.confirm(`Togliere "${etichetta}" dai sottoreparti?`)) return;
    setBusy(id);
    try {
      await eliminaSottoreparto(id);
      onChanged();
    } catch (e) {
      toast.error("Eliminazione non riuscita", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Sottoreparti</p>
      {figli.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {figli.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              {s.codice && (
                <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                  {s.codice}
                </span>
              )}
              <span className={`flex-1 ${s.attivo ? "" : "text-muted-foreground"}`}>{s.nome}</span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {s.attivo ? "Nel modulo" : "Nascosto"}
                <Switch
                  checked={s.attivo}
                  disabled={busy === s.id}
                  onCheckedChange={(v) => cambiaAttivo(s.id, v)}
                />
              </label>
              <Button
                variant="ghost"
                size="icon"
                disabled={busy === s.id}
                onClick={() => rimuovi(s.id, s.codice ? `${s.codice} — ${s.nome}` : s.nome)}
                aria-label={`Elimina ${s.nome}`}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          value={codice}
          onChange={(e) => setCodice(e.target.value.toUpperCase())}
          placeholder="Sigla"
          className="w-24 uppercase"
          maxLength={10}
        />
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && nome.trim()) aggiungi();
          }}
          placeholder="Nuovo sottoreparto, es. Assistente tecnico"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={aggiungi}
          disabled={!nome.trim() || busy === "nuovo"}
        >
          {busy === "nuovo" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

/* --------------------- CLASSI DI CONCORSO E MATERIE --------------------- */

function InsegnamentoTab() {
  const qc = useQueryClient();
  const [codice, setCodice] = useState("");
  const [denominazione, setDenominazione] = useState("");
  const [filtro, setFiltro] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const {
    data: classi = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["classi_concorso"],
    queryFn: getClassiConcorso,
    retry: false,
  });
  const { data: materie = [] } = useQuery({
    queryKey: ["materie"],
    queryFn: getMaterie,
    retry: false,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["classi_concorso"] });
    qc.invalidateQueries({ queryKey: ["materie"] });
  }

  const classiFiltrate = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return classi;
    return classi.filter(
      (c) =>
        c.codice.toLowerCase().includes(t) || (c.denominazione ?? "").toLowerCase().includes(t),
    );
  }, [classi, filtro]);

  async function aggiungi() {
    setBusy("nuovo");
    try {
      await aggiungiClasseConcorso(codice, denominazione);
      setCodice("");
      setDenominazione("");
      refresh();
    } catch (e) {
      toast.error("Classe non aggiunta", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function cambiaAttiva(id: string, attivo: boolean) {
    setBusy(id);
    try {
      await impostaClasseAttiva(id, attivo);
      refresh();
    } catch (e) {
      toast.error("Modifica non riuscita", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function rimuovi(id: string, etichetta: string) {
    if (!window.confirm(`Eliminare "${etichetta}" dai suggerimenti?`)) return;
    setBusy(id);
    try {
      await eliminaClasseConcorso(id);
      refresh();
    } catch (e) {
      toast.error("Eliminazione non riuscita", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function rimuoviMateria(id: string, nome: string) {
    if (!window.confirm(`Eliminare la materia "${nome}" dai suggerimenti?`)) return;
    setBusy(id);
    try {
      await eliminaMateria(id);
      refresh();
    } catch (e) {
      toast.error("Eliminazione non riuscita", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErroreTabelle messaggio={(error as Error).message} />;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Elenco proposto ai docenti nel modulo. Ogni valore nuovo scritto da un lavoratore viene
        aggiunto qui in automatico, così col tempo l'elenco si completa da solo.
      </p>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Classi di concorso ({classi.length})</p>
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Cerca…"
            className="h-8 w-40"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Caricamento…
          </div>
        ) : (
          <ul className="max-h-64 divide-y divide-border overflow-auto rounded-lg border border-border">
            {classiFiltrate.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="w-16 shrink-0 font-mono text-xs">{c.codice}</span>
                <span className={`flex-1 truncate ${c.attivo ? "" : "text-muted-foreground"}`}>
                  {c.denominazione ?? "—"}
                  {c.usi > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      usata {c.usi} {c.usi === 1 ? "volta" : "volte"}
                    </span>
                  )}
                </span>
                <Switch
                  checked={c.attivo}
                  disabled={busy === c.id}
                  onCheckedChange={(v) => cambiaAttiva(c.id, v)}
                  aria-label={`Mostra ${c.codice} nel modulo`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy === c.id}
                  onClick={() => rimuovi(c.id, c.codice)}
                  aria-label={`Elimina ${c.codice}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
            {!classiFiltrate.length && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nessuna classe di concorso.
              </li>
            )}
          </ul>
        )}

        <div className="flex gap-2">
          <Input
            value={codice}
            onChange={(e) => setCodice(e.target.value.toUpperCase())}
            placeholder="A-26"
            className="w-28 uppercase"
          />
          <Input
            value={denominazione}
            onChange={(e) => setDenominazione(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && codice.trim()) aggiungi();
            }}
            placeholder="Denominazione (facoltativa)"
          />
          <Button onClick={aggiungi} disabled={!codice.trim() || busy === "nuovo"}>
            {busy === "nuovo" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Aggiungi
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Materie raccolte ({materie.length})</p>
        {materie.length ? (
          <ul className="max-h-48 divide-y divide-border overflow-auto rounded-lg border border-border">
            {materie.map((m) => (
              <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-1 truncate">
                  {m.nome}
                  <span className="block text-xs text-muted-foreground">
                    {m.classe_concorso ? `${m.classe_concorso} · ` : ""}
                    indicata {m.usi} {m.usi === 1 ? "volta" : "volte"}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy === m.id}
                  onClick={() => rimuoviMateria(m.id, m.nome)}
                  aria-label={`Elimina ${m.nome}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            Ancora nessuna materia. Si riempie da sola man mano che i docenti compilano il modulo.
          </p>
        )}
      </div>
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex-1 text-sm text-muted-foreground">
          Elenco di tutte le categorie di corso, uguale per tutti. Attiva quelle che il lavoratore
          può scegliere nel modulo: le altre restano comunque visibili in dashboard HR e nelle
          schede dei dipendenti.
        </p>
        <TabellaTipiCorsoDialog />
      </div>

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

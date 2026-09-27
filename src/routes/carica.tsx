import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadPreview } from "@/components/UploadPreview";
import { CampoSuggerito } from "@/components/CampoSuggerito";
import {
  creaAttestato,
  etichettaSottoreparto,
  getCategorieNascoste,
  getClassiConcorso,
  getMaterie,
  getReparti,
  getSottoreparti,
  getTipiCorso,
  registraClasseEMateria,
  upsertDipendente,
  uploadFoto,
  type TipoCorso,
} from "@/lib/api";

export const Route = createFileRoute("/carica")({
  head: () => ({
    meta: [
      { title: "Carica il tuo attestato — Archivio Sicurezza" },
      {
        name: "description",
        content:
          "Modulo mobile per i lavoratori: inserisci i tuoi dati, scegli il corso e allega la foto dell'attestato di formazione sulla sicurezza.",
      },
      { property: "og:title", content: "Carica il tuo attestato" },
      {
        property: "og:description",
        content:
          "Compila i dati anagrafici, seleziona il corso e allega fronte e retro dell'attestato dal telefono.",
      },
    ],
  }),
  component: CaricaPage,
});

const LIVELLI = ["Base", "Specifico", "Aggiornamento"] as const;

function CaricaPage() {
  const { data: corsi = [] } = useQuery({
    queryKey: ["tipi_corso"],
    queryFn: getTipiCorso,
  });
  // Se le tabelle nuove non esistono ancora, il modulo funziona come prima.
  const { data: repartiElenco = [] } = useQuery({
    queryKey: ["reparti"],
    queryFn: getReparti,
    retry: false,
  });
  const { data: sottorepartiElenco = [] } = useQuery({
    queryKey: ["sottoreparti"],
    queryFn: getSottoreparti,
    retry: false,
  });
  const { data: classi = [] } = useQuery({
    queryKey: ["classi_concorso"],
    queryFn: getClassiConcorso,
    retry: false,
  });
  const { data: materie = [] } = useQuery({
    queryKey: ["materie"],
    queryFn: getMaterie,
    retry: false,
  });
  const { data: nascoste = [] } = useQuery({
    queryKey: ["categorie_nascoste"],
    queryFn: getCategorieNascoste,
    retry: false,
  });
  const reparti = useMemo(() => repartiElenco.filter((r) => r.attivo), [repartiElenco]);

  const [anagrafica, setAnagrafica] = useState({
    codice_fiscale: "",
    cognome: "",
    nome: "",
    email: "",
    reparto: "",
    sottoreparto: "",
    classe_concorso: "",
    materia: "",
    luogo_nascita: "",
    data_nascita: "",
  });
  const [macro, setMacro] = useState("");
  const [livello, setLivello] = useState<string>("");
  const [corsoId, setCorsoId] = useState("");
  const [dataCorso, setDataCorso] = useState("");
  const [ore, setOre] = useState("");
  const [fronte, setFronte] = useState<File | null>(null);
  const [retro, setRetro] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // Solo i corsi che il lavoratore può scegliere: rispetta sia il nascondimento
  // per macro-categoria sia l'interruttore per singolo corso (tabella corsi).
  const corsiVisibili = useMemo(() => corsi.filter((c) => c.visibile_lavoratore), [corsi]);

  const macros = useMemo(
    () =>
      Array.from(
        new Set(
          corsiVisibili
            .filter((c) => !nascoste.includes(c.macro_categoria))
            .map((c) => c.macro_categoria),
        ),
      ).sort(),
    [corsiVisibili, nascoste],
  );
  const livelli = useMemo(
    () =>
      LIVELLI.filter((l) =>
        corsiVisibili.some((c) => c.macro_categoria === macro && c.livello_specifico === l),
      ),
    [corsiVisibili, macro],
  );
  const corsiFiltrati = useMemo(
    () =>
      corsiVisibili.filter(
        (c: TipoCorso) =>
          c.macro_categoria === macro && (!livello || c.livello_specifico === livello),
      ),
    [corsiVisibili, macro, livello],
  );
  const corsoSelezionato = corsi.find((c) => c.id === corsoId);

  // Reparto scelto -> sottoreparti disponibili e obbligo di classe di concorso.
  const repartoScelto = useMemo(
    () => reparti.find((r) => r.nome === anagrafica.reparto) ?? null,
    [reparti, anagrafica.reparto],
  );
  const sottoreparti = useMemo(
    () =>
      repartoScelto
        ? sottorepartiElenco.filter((s) => s.reparto_id === repartoScelto.id && s.attivo)
        : [],
    [sottorepartiElenco, repartoScelto],
  );
  const chiedeInsegnamento = !!repartoScelto?.richiede_classe_concorso;

  // Suggerimenti: prima le classi più usate, poi tutte quelle in elenco.
  const suggerimentiClassi = useMemo(
    () =>
      classi
        .filter((c) => c.attivo)
        .sort((a, b) => b.usi - a.usi || a.codice.localeCompare(b.codice, "it"))
        .map((c) => ({ valore: c.codice, dettaglio: c.denominazione })),
    [classi],
  );
  const suggerimentiMaterie = useMemo(() => {
    const classe = anagrafica.classe_concorso.trim().toUpperCase();
    const collegate = materie.filter((m) => classe && m.classe_concorso === classe);
    const altre = materie.filter((m) => !classe || m.classe_concorso !== classe);
    return [...collegate, ...altre].map((m) => ({
      valore: m.nome,
      dettaglio: m.classe_concorso,
    }));
  }, [materie, anagrafica.classe_concorso]);

  function set<K extends keyof typeof anagrafica>(k: K, v: string) {
    setAnagrafica((a) => ({ ...a, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cf = anagrafica.codice_fiscale.trim().toUpperCase();
    if (cf.length !== 16) {
      toast.error("Codice fiscale non valido", {
        description: "Deve contenere 16 caratteri.",
      });
      return;
    }
    if (reparti.length > 0 && !anagrafica.reparto) {
      toast.error("Scegli il tuo reparto");
      return;
    }
    if (sottoreparti.length > 0 && !anagrafica.sottoreparto) {
      toast.error("Scegli il tuo profilo dentro il reparto");
      return;
    }
    if (chiedeInsegnamento && !anagrafica.classe_concorso.trim()) {
      toast.error("Indica la classe di concorso");
      return;
    }
    if (chiedeInsegnamento && !anagrafica.materia.trim()) {
      toast.error("Indica la materia insegnata");
      return;
    }
    if (!corsoId || !dataCorso) {
      toast.error("Completa corso e data del corso");
      return;
    }
    if (!fronte) {
      toast.error("Allega almeno la foto del fronte dell'attestato");
      return;
    }
    setBusy(true);
    try {
      const dip = await upsertDipendente({
        codice_fiscale: cf,
        cognome: anagrafica.cognome.trim(),
        nome: anagrafica.nome.trim(),
        email: anagrafica.email.trim() || null,
        reparto: anagrafica.reparto.trim() || null,
        sottoreparto: anagrafica.sottoreparto.trim() || null,
        classe_concorso: chiedeInsegnamento
          ? anagrafica.classe_concorso.trim().toUpperCase() || null
          : null,
        materia: chiedeInsegnamento ? anagrafica.materia.trim() || null : null,
        luogo_nascita: anagrafica.luogo_nascita.trim() || null,
        data_nascita: anagrafica.data_nascita || null,
      });
      // Alimenta il database dei suggerimenti per chi compila dopo.
      if (chiedeInsegnamento) {
        await registraClasseEMateria(anagrafica.classe_concorso, anagrafica.materia);
      }
      const pFronte = await uploadFoto(fronte, cf, "fronte");
      const pRetro = retro ? await uploadFoto(retro, cf, "retro") : null;
      await creaAttestato({
        dipendente_id: dip.id,
        codice_fiscale: cf,
        tipo_corso_id: corsoId,
        data_corso: dataCorso,
        ore_dichiarate: ore ? Number(ore) : null,
        url_foto_fronte: pFronte,
        url_foto_retro: pRetro,
      });
      setDone(true);
    } catch (err) {
      toast.error("Invio non riuscito", { description: String(err) });
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-background px-5 text-center">
        <CheckCircle2 className="size-14 text-success" />
        <h1 className="font-display text-2xl font-semibold">Attestato inviato</h1>
        <p className="text-sm text-muted-foreground">
          Il tuo attestato è in attesa di validazione da parte dell'ufficio personale. Riceverai
          l'esito via email.
        </p>
        <Button
          onClick={() => {
            setDone(false);
            setCorsoId("");
            setDataCorso("");
            setOre("");
            setFronte(null);
            setRetro(null);
          }}
        >
          Carica un altro attestato
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-16">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-4">
          <Link to="/" aria-label="Torna alla home">
            <ArrowLeft className="size-5 text-muted-foreground" />
          </Link>
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-base font-semibold">Carica il tuo attestato</h1>
            <p className="text-xs text-muted-foreground">Formazione sicurezza</p>
          </div>
        </div>
      </header>

      <form onSubmit={submit} className="mx-auto max-w-md space-y-8 px-5 py-6">
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">1. I tuoi dati</h2>
          <Field label="Codice fiscale *">
            <Input
              required
              value={anagrafica.codice_fiscale}
              onChange={(e) => set("codice_fiscale", e.target.value.toUpperCase())}
              maxLength={16}
              autoCapitalize="characters"
              className="h-12 uppercase"
            />
          </Field>
          <Field label="Cognome *">
            <Input
              required
              value={anagrafica.cognome}
              onChange={(e) => set("cognome", e.target.value)}
              className="h-12"
            />
          </Field>
          <Field label="Nome *">
            <Input
              required
              value={anagrafica.nome}
              onChange={(e) => set("nome", e.target.value)}
              className="h-12"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={anagrafica.email}
              onChange={(e) => set("email", e.target.value)}
              className="h-12"
            />
          </Field>
          {reparti.length > 0 ? (
            <Field label="Reparto *">
              <Select
                value={anagrafica.reparto}
                onValueChange={(v) =>
                  setAnagrafica((a) => ({
                    ...a,
                    reparto: v,
                    sottoreparto: "",
                    classe_concorso: "",
                    materia: "",
                  }))
                }
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Scegli il reparto" />
                </SelectTrigger>
                <SelectContent>
                  {reparti.map((r) => (
                    <SelectItem key={r.id} value={r.nome}>
                      {r.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field label="Reparto">
              <Input
                value={anagrafica.reparto}
                onChange={(e) => set("reparto", e.target.value)}
                className="h-12"
              />
            </Field>
          )}

          {sottoreparti.length > 0 && (
            <Field label="Profilo / sottoreparto *">
              <Select value={anagrafica.sottoreparto} onValueChange={(v) => set("sottoreparto", v)}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Scegli il profilo" />
                </SelectTrigger>
                <SelectContent>
                  {sottoreparti.map((s) => (
                    <SelectItem key={s.id} value={s.nome}>
                      {etichettaSottoreparto(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {chiedeInsegnamento && (
            <>
              <Field label="Classe di concorso *">
                <CampoSuggerito
                  value={anagrafica.classe_concorso}
                  onChange={(v: string) => set("classe_concorso", v)}
                  suggerimenti={suggerimentiClassi}
                  placeholder="es. A-26"
                  maiuscolo
                  className="h-12"
                />
                <p className="text-xs text-muted-foreground">
                  Scegli dall'elenco oppure scrivila: se manca, viene aggiunta all'archivio.
                </p>
              </Field>
              <Field label="Materia insegnata *">
                <CampoSuggerito
                  value={anagrafica.materia}
                  onChange={(v: string) => set("materia", v)}
                  suggerimenti={suggerimentiMaterie}
                  placeholder="es. Matematica"
                  className="h-12"
                />
              </Field>
            </>
          )}
          <Field label="Luogo di nascita">
            <Input
              value={anagrafica.luogo_nascita}
              onChange={(e) => set("luogo_nascita", e.target.value)}
              className="h-12"
            />
          </Field>
          <Field label="Data di nascita">
            <Input
              type="date"
              value={anagrafica.data_nascita}
              onChange={(e) => set("data_nascita", e.target.value)}
              className="h-12"
            />
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">2. Il corso</h2>
          <Field label="Categoria del corso *">
            <Select
              value={macro}
              onValueChange={(v) => {
                setMacro(v);
                setLivello("");
                setCorsoId("");
              }}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Scegli la categoria" />
              </SelectTrigger>
              <SelectContent>
                {macros.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {macro && (
            <Field label="Livello *">
              <RadioGroup
                value={livello}
                onValueChange={(v) => {
                  setLivello(v);
                  setCorsoId("");
                }}
                className="grid gap-2"
              >
                {livelli.map((l) => (
                  <label
                    key={l}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                  >
                    <RadioGroupItem value={l} />
                    {l}
                  </label>
                ))}
              </RadioGroup>
            </Field>
          )}

          {macro && livello && (
            <Field label="Corso *">
              <RadioGroup
                value={corsoId}
                onValueChange={(v) => {
                  setCorsoId(v);
                  const c = corsi.find((x) => x.id === v);
                  if (c?.ore_minime_legge) setOre(String(c.ore_minime_legge));
                }}
                className="grid gap-2"
              >
                {corsiFiltrati.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm"
                  >
                    <RadioGroupItem value={c.id} className="mt-0.5" />
                    <span>
                      {c.nome_corso}
                      <span className="block text-xs text-muted-foreground">
                        {c.ore_minime_legge ? `${c.ore_minime_legge} ore · ` : ""}
                        {c.durata_validita_anni
                          ? `validità ${c.durata_validita_anni} anni`
                          : "senza scadenza"}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </Field>
          )}

          <Field label="Data del corso *">
            <Input
              required
              type="date"
              value={dataCorso}
              onChange={(e) => setDataCorso(e.target.value)}
              className="h-12"
            />
          </Field>
          <Field label="Ore dichiarate">
            <Input
              type="number"
              min={0}
              step="0.5"
              value={ore}
              onChange={(e) => setOre(e.target.value)}
              className="h-12"
            />
          </Field>
          {corsoSelezionato?.durata_validita_anni && dataCorso && (
            <p className="rounded-lg bg-accent/50 px-3 py-2 text-xs text-accent-foreground">
              Scadenza calcolata:{" "}
              {new Date(
                new Date(dataCorso).setFullYear(
                  new Date(dataCorso).getFullYear() + corsoSelezionato.durata_validita_anni,
                ),
              ).toLocaleDateString("it-IT")}
            </p>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">3. Foto attestato</h2>
          <UploadPreview label="Fronte" file={fronte} onChange={setFronte} />
          <UploadPreview label="Retro" file={retro} onChange={setRetro} />
        </section>

        <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={busy}>
          {busy && <Loader2 className="size-5 animate-spin" />}
          Invia attestato
        </Button>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

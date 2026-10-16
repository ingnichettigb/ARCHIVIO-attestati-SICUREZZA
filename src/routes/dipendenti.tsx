/*
 * File:      dipendenti.tsx
 * Percorso:  src/routes/dipendenti.tsx
 * Data:      14/10/2026
 * Modifica:  01
 *
 * Modifica 01:
 *  - Scheda lavoratore: se ha integrazioni DVR da completare compare, sotto "Incarichi e formazione",
 *    un riquadro arancione "Integrazione DVR: N ore - Da completare" con gli argomenti da integrare
 *    e il pulsante "Segna completata". Senza integrazioni la scheda resta come prima.
 *  - Tabella "Tutti gli attestati": le integrazioni compaiono come righe con stato
 *    "Da completare" / "Completata".
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BackupBar } from "@/components/BackupBar";
import { ImpostazioniDialog } from "@/components/ImpostazioniDialog";
import { DocumentiAttestati } from "@/components/DocumentiAttestati";
import {
  aggiornaRepartoDipendente,
  chiudiIntegrazioneDvr,
  etichettaStato,
  formatData,
  getAttestati,
  getDipendenti,
  getIntegrazioniDvr,
  getReparti,
  getRuoliSicurezza,
  getAssegnazioniRuoli,
  impostaRuoloDipendente,
  ruoliDelDipendente,
  repartoLeggibile,
  riepilogoIncarichi,
  scadenzaBadgeClass,
  scaduto,
  statoBadgeClass,
  upsertDipendente,
  type Dipendente,
  type IntegrazioneDvr,
} from "@/lib/api";

export const Route = createFileRoute("/dipendenti")({
  head: () => ({
    meta: [
      { title: "Gestione Dipendenti — Archivio Sicurezza" },
      {
        name: "description",
        content:
          "Elenco completo dei dipendenti, anagrafiche e storico degli attestati di formazione sulla sicurezza.",
      },
      { property: "og:title", content: "Gestione Dipendenti" },
      {
        property: "og:description",
        content:
          "Cerca un dipendente, aggiungi nominativi e consulta lo storico dei suoi attestati di sicurezza.",
      },
    ],
  }),
  component: DipendentiPage,
});

const TUTTI = "__tutti__";
const NESSUNO = "__nessuno__";

const VUOTO: Omit<Dipendente, "id"> = {
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
  codice_ateco: "",
};

function DipendentiPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Dipendente, "id"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [filtroReparto, setFiltroReparto] = useState(TUTTI);

  const { data: repartiElenco = [] } = useQuery({
    queryKey: ["reparti"],
    queryFn: getReparti,
    retry: false,
  });
  const { data: dipendenti = [], isLoading } = useQuery({
    queryKey: ["dipendenti"],
    queryFn: getDipendenti,
  });
  const { data: attestati = [] } = useQuery({
    queryKey: ["attestati", "Tutti"],
    queryFn: () => getAttestati("Tutti"),
  });
  const { data: ruoliCatalogo = [] } = useQuery({
    queryKey: ["ruoli-sicurezza"],
    queryFn: getRuoliSicurezza,
    retry: false,
  });
  const { data: assegnazioni = [] } = useQuery({
    queryKey: ["dipendenti-ruoli"],
    queryFn: getAssegnazioniRuoli,
    retry: false,
  });
  const [filtroRuolo, setFiltroRuolo] = useState(TUTTI);
  const { data: integrazioni = [] } = useQuery({
    queryKey: ["integrazioni-dvr"],
    queryFn: getIntegrazioniDvr,
    retry: false,
  });

  // Reparti scelti dal lavoratore nel modulo (solo quelli attivi).
  const repartiAttivi = useMemo(
    () => repartiElenco.filter((r) => r.attivo).map((r) => r.nome),
    [repartiElenco],
  );

  // Per il filtro: elenco + valori già presenti nei dipendenti.
  const repartiFiltro = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of repartiElenco) set.set(r.nome.toLowerCase(), r.nome);
    for (const d of dipendenti)
      if (repartoLeggibile(d.reparto) && !set.has(d.reparto.trim().toLowerCase()))
        set.set(d.reparto.trim().toLowerCase(), d.reparto.trim());
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "it"));
  }, [repartiElenco, dipendenti]);

  const filtrati = useMemo(() => {
    const t = q.trim().toLowerCase();
    return dipendenti.filter((d) => {
      if (filtroReparto === NESSUNO && repartoLeggibile(d.reparto)) return false;
      if (
        filtroReparto !== TUTTI &&
        filtroReparto !== NESSUNO &&
        (d.reparto ?? "").trim().toLowerCase() !== filtroReparto.toLowerCase()
      )
        return false;
      if (filtroRuolo !== TUTTI) {
        const mieiRuoli = ruoliDelDipendente(d.id, ruoliCatalogo, assegnazioni);
        if (filtroRuolo === "__mancanti__") {
          const suoiD = attestati.filter((a) => a.dipendente_id === d.id);
          const manca = mieiRuoli.some(
            (ru) => ru.macro_categoria && !suoiD.some((a) => a.tipi_corso?.macro_categoria === ru.macro_categoria),
          );
          if (!manca) return false;
        } else if (!mieiRuoli.some((ru) => ru.id === filtroRuolo)) return false;
      }
      if (!t) return true;
      return `${d.cognome} ${d.nome} ${d.codice_fiscale} ${d.reparto ?? ""}`
        .toLowerCase()
        .includes(t);
    });
  }, [dipendenti, q, filtroReparto, filtroRuolo, ruoliCatalogo, assegnazioni, attestati]);

  const corrente = dipendenti.find((d) => d.id === sel) ?? null;
  const suoi = attestati.filter((a) => a.dipendente_id === sel);
  const suoiInteg = integrazioni.filter((i) => i.dipendente_id === sel);
  const integAperte = suoiInteg.filter((i) => i.stato === "Da completare");
  const ruoliCorrente = sel ? ruoliDelDipendente(sel, ruoliCatalogo, assegnazioni) : [];
  const categorieRichieste = new Set(ruoliCorrente.map((r) => r.macro_categoria).filter(Boolean));
  const ruoliAttivi = ruoliCatalogo.filter((r) => r.attivo);

  async function spuntaRuolo(ruoloId: string, v: boolean) {
    if (!sel) return;
    try {
      await impostaRuoloDipendente(sel, ruoloId, v);
      qc.invalidateQueries({ queryKey: ["dipendenti-ruoli"] });
    } catch (e) {
      toast.error("Modifica non riuscita", { description: (e as Error).message });
    }
  }

  async function segnaCompletata(i: IntegrazioneDvr) {
    if (!window.confirm(`Segnare come completata "${i.descrizione}" senza collegare un attestato?`)) return;
    try {
      await chiudiIntegrazioneDvr(i.id, null);
      qc.invalidateQueries({ queryKey: ["integrazioni-dvr"] });
      toast.success("Integrazione segnata come completata");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function salva() {
    if (!form) return;
    if (!form.codice_fiscale.trim() || !form.cognome.trim() || !form.nome.trim()) {
      toast.error("Cognome, nome e codice fiscale sono obbligatori");
      return;
    }
    setSaving(true);
    try {
      await upsertDipendente(form);
      toast.success("Dipendente salvato");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["dipendenti"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function cambiaReparto(id: string, valore: string) {
    try {
      await aggiornaRepartoDipendente(id, valore === NESSUNO ? null : valore);
      toast.success("Reparto aggiornato");
      qc.invalidateQueries({ queryKey: ["dipendenti"] });
      qc.invalidateQueries({ queryKey: ["attestati"] });
    } catch (e) {
      toast.error("Modifica non riuscita", { description: (e as Error).message });
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Torna alla home">
              <ArrowLeft className="size-5 text-muted-foreground" />
            </Link>
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Users className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold">Dipendenti</h1>
              <p className="text-xs text-muted-foreground">
                {dipendenti.length} nominativi in archivio
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ImpostazioniDialog />
            <BackupBar />
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1400px] gap-6 px-5 py-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cerca per cognome, nome, CF o reparto"
                className="pl-9"
              />
            </div>
            <Select value={filtroReparto} onValueChange={setFiltroReparto}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TUTTI}>Tutti i reparti</SelectItem>
                {repartiFiltro.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
                <SelectItem value={NESSUNO}>Senza reparto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroRuolo} onValueChange={setFiltroRuolo}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TUTTI}>Tutti i ruoli</SelectItem>
                {ruoliAttivi.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
                <SelectItem value="__mancanti__">Con corsi mancanti</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setForm({ ...VUOTO })}>
              <Plus className="size-4" /> Nuovo
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Caricamento…
            </div>
          ) : (
            <ul className="mt-4 max-h-[65vh] divide-y divide-border overflow-auto rounded-lg border border-border">
              {filtrati.map((d) => {
                const suoiD = attestati.filter((a) => a.dipendente_id === d.id);
                const ruoli = riepilogoIncarichi(suoiD).filter((r) => r.ricoperto);
                return (
                  <li key={d.id}>
                    <button
                      onClick={() => setSel(d.id)}
                      className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/50 ${
                        sel === d.id ? "bg-muted" : ""
                      }`}
                    >
                      <span>
                        <span className="font-medium">
                          {d.cognome} {d.nome}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {d.codice_fiscale}
                          {d.reparto ? ` · ${d.reparto}` : ""}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {ruoli.map((r) => (
                            <span
                              key={r.incarico.key}
                              className={`rounded-full border px-1.5 py-0.5 text-[10px] ${scadenzaBadgeClass(
                                r.peggiore,
                              )}`}
                            >
                              {r.incarico.label}
                            </span>
                          ))}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                        {suoiD.length} attestati
                      </span>
                    </button>
                  </li>
                );
              })}
              {!filtrati.length && (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nessun dipendente trovato
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
          {form ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Nuovo dipendente</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo
                  label="Cognome"
                  value={form.cognome}
                  onChange={(v) => setForm({ ...form, cognome: v })}
                />
                <Campo
                  label="Nome"
                  value={form.nome}
                  onChange={(v) => setForm({ ...form, nome: v })}
                />
                <Campo
                  label="Codice fiscale"
                  value={form.codice_fiscale}
                  onChange={(v) => setForm({ ...form, codice_fiscale: v.toUpperCase() })}
                />
                <Campo
                  label="Email"
                  value={form.email ?? ""}
                  onChange={(v) => setForm({ ...form, email: v })}
                />
                {repartiAttivi.length > 0 ? (
                  <div className="space-y-1.5">
                    <Label>Reparto</Label>
                    <Select
                      value={form.reparto ?? ""}
                      onValueChange={(v) => setForm({ ...form, reparto: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Scegli il reparto" />
                      </SelectTrigger>
                      <SelectContent>
                        {repartiAttivi.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <Campo
                    label="Reparto"
                    value={form.reparto ?? ""}
                    onChange={(v) => setForm({ ...form, reparto: v })}
                  />
                )}
                <Campo
                  label="Codice ATECO"
                  value={form.codice_ateco ?? ""}
                  onChange={(v) => setForm({ ...form, codice_ateco: v })}
                />
                <Campo
                  label="Luogo di nascita"
                  value={form.luogo_nascita ?? ""}
                  onChange={(v) => setForm({ ...form, luogo_nascita: v })}
                />
                <Campo
                  label="Data di nascita"
                  type="date"
                  value={form.data_nascita ?? ""}
                  onChange={(v) => setForm({ ...form, data_nascita: v })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={salva} disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />} Salva
                </Button>
                <Button variant="outline" onClick={() => setForm(null)}>
                  Annulla
                </Button>
              </div>
            </div>
          ) : corrente ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {corrente.cognome} {corrente.nome}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {corrente.codice_fiscale}
                  {corrente.reparto ? ` · ${corrente.reparto}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Nato/a a {corrente.luogo_nascita || "—"} il {formatData(corrente.data_nascita)} ·{" "}
                  {corrente.email || "email non presente"}
                  {corrente.codice_ateco ? ` · ATECO ${corrente.codice_ateco}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 px-3 py-2.5">
                <Label className="text-sm">Reparto</Label>
                <Select
                  value={repartoLeggibile(corrente.reparto) ? corrente.reparto.trim() : NESSUNO}
                  onValueChange={(v) => cambiaReparto(corrente.id, v)}
                >
                  <SelectTrigger className="w-[220px] bg-surface">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NESSUNO}>Nessun reparto</SelectItem>
                    {(repartoLeggibile(corrente.reparto) &&
                    !repartiAttivi.includes(corrente.reparto.trim())
                      ? [corrente.reparto.trim(), ...repartiAttivi]
                      : repartiAttivi
                    ).map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 rounded-xl border border-border p-3">
                <h3 className="text-sm font-semibold">Ruoli e incarichi assegnati</h3>
                {ruoliAttivi.length ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ruoliAttivi.map((r) => {
                      const spuntato =
                        r.obbligatorio_tutti ||
                        assegnazioni.some((a) => a.dipendente_id === corrente.id && a.ruolo_id === r.id);
                      return (
                        <label key={r.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={spuntato}
                            disabled={r.obbligatorio_tutti}
                            onCheckedChange={(v) => spuntaRuolo(r.id, v === true)}
                          />
                          {r.nome}
                          {r.obbligatorio_tutti && (
                            <span className="text-[10px] text-muted-foreground">(per tutti)</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Nessun ruolo: aggiungili da Impostazioni → Ruoli.
                  </p>
                )}
                {ruoliCorrente
                  .filter(
                    (r) =>
                      r.macro_categoria &&
                      !suoi.some((a) => a.tipi_corso?.macro_categoria === r.macro_categoria),
                  )
                  .map((r) => (
                    <p
                      key={r.id}
                      className="rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive"
                    >
                      Da svolgere: corso {r.macro_categoria} per il ruolo {r.nome}
                    </p>
                  ))}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Incarichi e formazione</h3>
                {integAperte.map((i) => (
                  <div key={i.id} className="rounded-xl border border-warning/50 bg-warning/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        Integrazione DVR: {i.ore ? `${i.ore} ore` : i.descrizione}
                      </span>
                      <span className="rounded-full border border-warning/50 bg-warning/15 px-2 py-0.5 text-[11px] text-warning-foreground">
                        Da completare
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {i.tipo_corso_nome ? `Dal corso: ${i.tipo_corso_nome} · ` : ""}richiesta il {formatData(i.data_richiesta)}
                    </p>
                    {i.argomenti_mancanti.length > 0 && (
                      <p className="mt-1 text-xs">Argomenti da integrare: {i.argomenti_mancanti.join(", ")}</p>
                    )}
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => segnaCompletata(i)}>
                      Segna completata
                    </Button>
                  </div>
                ))}
                <div className="grid gap-3 sm:grid-cols-2">
                  {riepilogoIncarichi(suoi).map((r) => (
                    <div
                      key={r.incarico.key}
                      className={`rounded-xl border p-3 ${
                        r.ricoperto
                          ? "border-border bg-background"
                          : "border-dashed border-border/70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{r.incarico.label}</span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${scadenzaBadgeClass(
                            r.peggiore,
                          )}`}
                        >
                          {r.ricoperto
                            ? etichettaStato(r.peggiore)
                            : categorieRichieste.has(r.incarico.categoria)
                              ? "Da svolgere"
                              : "Non incaricato"}
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {r.voci.map((v) => (
                          <li
                            key={v.livello}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="text-muted-foreground">{v.livello}</span>
                            {v.attestato ? (
                              <span className="text-right">
                                {formatData(v.attestato.data_corso)}
                                <span
                                  className={`ml-2 rounded-full border px-1.5 py-0.5 ${scadenzaBadgeClass(
                                    v.stato,
                                  )}`}
                                >
                                  {v.attestato.data_scadenza_calcolata
                                    ? `scade ${formatData(v.attestato.data_scadenza_calcolata)}`
                                    : "senza scadenza"}
                                </span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground/70">assente</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Riquadro Gestione PDF Attestati */}
              <DocumentiAttestati dipendente={corrente} />

              <h3 className="text-sm font-semibold">Tutti gli attestati</h3>

              <div className="overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Corso</th>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Scadenza</th>
                      <th className="px-3 py-2">Stato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {suoi.map((a) => (
                      <tr key={a.id}>
                        <td className="px-3 py-2">{a.tipi_corso?.nome_corso ?? "—"}</td>
                        <td className="px-3 py-2">{formatData(a.data_corso)}</td>
                        <td
                          className={`px-3 py-2 ${
                            scaduto(a.data_scadenza_calcolata) ? "font-medium text-destructive" : ""
                          }`}
                        >
                          {a.data_scadenza_calcolata
                            ? formatData(a.data_scadenza_calcolata)
                            : "senza scadenza"}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs ${statoBadgeClass(
                              a.stato_validazione,
                            )}`}
                          >
                            {a.stato_validazione}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {suoiInteg.map((i) => (
                      <tr key={`integrazione-${i.id}`}>
                        <td className="px-3 py-2">Integrazione DVR — {i.descrizione}</td>
                        <td className="px-3 py-2">{formatData(i.data_richiesta)}</td>
                        <td className="px-3 py-2 text-muted-foreground">—</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs ${
                              i.stato === "Completata"
                                ? "border-success/40 bg-success/12 text-success"
                                : "border-warning/50 bg-warning/15 text-warning-foreground"
                            }`}
                          >
                            {i.stato}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!suoi.length && !suoiInteg.length && (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                          Nessun attestato registrato
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Seleziona un dipendente per vedere i suoi attestati, oppure aggiungine uno nuovo.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function Campo({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

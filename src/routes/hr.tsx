import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Loader2, ShieldCheck, Check, X, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageViewer } from "@/components/ImageViewer";
import { BackupBar } from "@/components/BackupBar";
import { ImpostazioniDialog } from "@/components/ImpostazioniDialog";
import {
  aggiornaAttestato,
  apriEmailEsito,
  formatData,
  getAttestati,
  getTipiCorso,
  scaduto,
  statoBadgeClass,
  type Attestato,
  type Stato,
} from "@/lib/api";

export const Route = createFileRoute("/hr")({
  head: () => ({
    meta: [
      { title: "Dashboard HR — Validazione attestati sicurezza" },
      {
        name: "description",
        content:
          "Dashboard desktop per l'ufficio personale: filtra gli attestati per stato, verifica le immagini, correggi i dati e approva o respingi.",
      },
      { property: "og:title", content: "Dashboard HR attestati" },
      {
        property: "og:description",
        content:
          "Valida gli attestati caricati dai lavoratori: revisione immagini, modifica dati e notifica di esito.",
      },
    ],
  }),
  component: HrPage,
});

const FILTRI: (Stato | "Tutti")[] = ["In attesa", "Approvato", "Respinto", "Tutti"];

function HrPage() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<Stato | "Tutti">("In attesa");
  const [sel, setSel] = useState<string | null>(null);

  const { data: attestati = [], isLoading } = useQuery({
    queryKey: ["attestati", filtro],
    queryFn: () => getAttestati(filtro),
  });
  const { data: corsi = [] } = useQuery({
    queryKey: ["tipi_corso"],
    queryFn: getTipiCorso,
  });

  const corrente = attestati.find((a) => a.id === sel) ?? null;

  function refresh() {
    qc.invalidateQueries({ queryKey: ["attestati"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Torna alla home">
              <ArrowLeft className="size-5 text-muted-foreground" />
            </Link>
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-base font-semibold">Dashboard HR</h1>
              <p className="text-xs text-muted-foreground">Validazione attestati di formazione</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ImpostazioniDialog />
            <BackupBar onImported={refresh} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-5 py-6 lg:grid-cols-[380px_1fr]">
        <aside className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {FILTRI.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFiltro(f);
                  setSel(null);
                }}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  filtro === f
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="max-h-[70vh] space-y-2 overflow-auto pr-1">
            {isLoading && (
              <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Caricamento…
              </p>
            )}
            {!isLoading && attestati.length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nessun attestato in questo stato.
              </p>
            )}
            {attestati.map((a) => (
              <button
                key={a.id}
                onClick={() => setSel(a.id)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  sel === a.id
                    ? "border-primary bg-accent/50"
                    : "border-border bg-surface hover:bg-accent/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {a.dipendenti?.cognome} {a.dipendenti?.nome}
                  </span>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${statoBadgeClass(a.stato_validazione)}`}
                  >
                    {a.stato_validazione}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.tipi_corso?.nome_corso ?? "—"}
                </p>
                {a.dipendenti?.reparto && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reparto: {a.dipendenti.reparto}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  Corso del {formatData(a.data_corso)} · scadenza{" "}
                  <span className={scaduto(a.data_scadenza_calcolata) ? "text-destructive" : ""}>
                    {formatData(a.data_scadenza_calcolata)}
                  </span>
                </p>
              </button>
            ))}
          </div>
        </aside>

        {corrente ? (
          <Dettaglio key={corrente.id} attestato={corrente} corsi={corsi} onChanged={refresh} />
        ) : (
          <div className="grid min-h-96 place-items-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
            Seleziona un attestato dalla lista per validarlo.
          </div>
        )}
      </div>
    </main>
  );
}

function Dettaglio({
  attestato,
  corsi,
  onChanged,
}: {
  attestato: Attestato;
  corsi: { id: string; nome_corso: string; macro_categoria: string }[];
  onChanged: () => void;
}) {
  const [tipoCorsoId, setTipoCorsoId] = useState(attestato.tipo_corso_id);
  const [dataCorso, setDataCorso] = useState(attestato.data_corso.slice(0, 10));
  const [ore, setOre] = useState(
    attestato.ore_dichiarate != null ? String(attestato.ore_dichiarate) : "",
  );
  const [note, setNote] = useState(attestato.note_rifiuto ?? "");
  const [mostraNote, setMostraNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const d = attestato.dipendenti;
  const haEmail = Boolean(d?.email?.trim());
  const [inviaEmail, setInviaEmail] = useState(haEmail);

  async function decidi(esito: Stato) {
    if (esito === "Respinto" && !note.trim()) {
      setMostraNote(true);
      toast.error("Le note di rifiuto sono obbligatorie");
      return;
    }
    setBusy(true);
    try {
      const agg = await aggiornaAttestato(attestato.id, {
        tipo_corso_id: tipoCorsoId,
        data_corso: dataCorso,
        ore_dichiarate: ore ? Number(ore) : null,
        stato_validazione: esito,
        note_rifiuto: esito === "Respinto" ? note.trim() : null,
        data_validazione: new Date().toISOString(),
      });
      let descrizione = "Esito salvato.";
      if (inviaEmail) {
        descrizione = apriEmailEsito(agg, esito)
          ? "Si è aperta la tua app di posta con il messaggio già scritto: premi Invia."
          : "Esito salvato, ma nessuna email preparata: il dipendente non ha un indirizzo email.";
      }
      toast.success(esito === "Approvato" ? "Attestato approvato" : "Attestato respinto", {
        description: descrizione,
        action:
          inviaEmail && haEmail
            ? { label: "Riapri email", onClick: () => apriEmailEsito(agg, esito) }
            : undefined,
      });
      onChanged();
    } catch (e) {
      toast.error("Operazione non riuscita", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-5 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] xl:grid-cols-2">
      <div className="space-y-5">
        <div>
          <h2 className="font-display text-xl font-semibold">
            {d?.cognome} {d?.nome}
          </h2>
          <p className="text-sm text-muted-foreground">{d?.codice_fiscale}</p>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-muted/40 p-4 text-sm">
          <Info label="Email" value={d?.email ?? "—"} />
          <Info label="Reparto" value={d?.reparto ?? "—"} />
          <Info label="Luogo di nascita" value={d?.luogo_nascita ?? "—"} />
          <Info label="Data di nascita" value={formatData(d?.data_nascita)} />
          <Info label="Stato" value={attestato.stato_validazione} />
          <Info label="Scadenza" value={formatData(attestato.data_scadenza_calcolata)} />
        </dl>

        <div className="space-y-2">
          <Label>Tipo corso</Label>
          <Select value={tipoCorsoId} onValueChange={setTipoCorsoId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {corsi.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.macro_categoria} — {c.nome_corso}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Data corso</Label>
            <Input type="date" value={dataCorso} onChange={(e) => setDataCorso(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Ore dichiarate</Label>
            <Input type="number" step="0.5" value={ore} onChange={(e) => setOre(e.target.value)} />
          </div>
        </div>

        {mostraNote && (
          <div className="space-y-2">
            <Label>Note di rifiuto *</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Indica il motivo del respingimento"
            />
          </div>
        )}

        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={inviaEmail && haEmail}
              disabled={!haEmail || busy}
              onCheckedChange={(v) => setInviaEmail(v === true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">Invia email di esito al dipendente</span>
              <span className="block text-xs text-muted-foreground">
                {haEmail
                  ? `Scritta per ${d?.email}: si apre la tua app di posta, tu premi Invia. Vale sia per approvato che per respinto (con il motivo).`
                  : "Non disponibile: il dipendente non ha un'email in archivio."}
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => decidi("Approvato")} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Approva
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => (mostraNote ? decidi("Respinto") : setMostraNote(true))}
          >
            <X className="size-4" />
            Respingi
          </Button>
          {attestato.stato_validazione !== "In attesa" && (
            <Button
              variant="outline"
              disabled={!haEmail}
              onClick={() => {
                if (!apriEmailEsito(attestato, attestato.stato_validazione))
                  toast.error("Il dipendente non ha un'email in archivio");
              }}
            >
              <Mail className="size-4" />
              Invia di nuovo email di esito
            </Button>
          )}
        </div>
      </div>

      <div>
        <ImageViewer fronte={attestato.url_foto_fronte} retro={attestato.url_foto_retro} />
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

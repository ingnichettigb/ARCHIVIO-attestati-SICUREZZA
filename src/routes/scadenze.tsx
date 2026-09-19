import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatData, getAttestati, repartoLeggibile, scaduto } from "@/lib/api";

export const Route = createFileRoute("/scadenze")({
  head: () => ({
    meta: [
      { title: "Attestati scaduti e in scadenza — Archivio Sicurezza" },
      {
        name: "description",
        content:
          "Elenco dei certificati di formazione scaduti e in scadenza nei prossimi mesi, con nome del dipendente, corso e data di scadenza.",
      },
      { property: "og:title", content: "Attestati scaduti e in scadenza" },
      {
        property: "og:description",
        content:
          "Chi ha i certificati scaduti e quali corsi vanno rinnovati: elenco filtrabile e ordinato per data.",
      },
    ],
  }),
  component: ScadenzePage,
});

type Vista = "Scaduti" | "In scadenza (90 gg)" | "Tutti con scadenza";

const TUTTI = "__tutti__";

function ScadenzePage() {
  const [vista, setVista] = useState<Vista>("Scaduti");
  const [q, setQ] = useState("");
  const [reparto, setReparto] = useState(TUTTI);

  const { data: attestati = [], isLoading } = useQuery({
    queryKey: ["attestati", "Tutti"],
    queryFn: () => getAttestati("Tutti"),
  });

  const reparti = useMemo(() => {
    const set = new Map<string, string>();
    for (const a of attestati) {
      const r = a.dipendenti?.reparto;
      if (repartoLeggibile(r) && !set.has(r.trim().toLowerCase()))
        set.set(r.trim().toLowerCase(), r.trim());
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "it"));
  }, [attestati]);

  const righe = useMemo(() => {
    const oggi = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + 90);
    const base = attestati.filter(
      (a) =>
        a.data_scadenza_calcolata &&
        (reparto === TUTTI ||
          (a.dipendenti?.reparto ?? "").trim().toLowerCase() === reparto.toLowerCase()),
    );
    const filtrate = base.filter((a) => {
      const d = new Date(a.data_scadenza_calcolata as string);
      if (vista === "Scaduti") return d < oggi;
      if (vista === "In scadenza (90 gg)") return d >= oggi && d <= limite;
      return true;
    });
    const t = q.trim().toLowerCase();
    const cercate = t
      ? filtrate.filter((a) =>
          `${a.dipendenti?.cognome ?? ""} ${a.dipendenti?.nome ?? ""} ${a.codice_fiscale} ${
            a.tipi_corso?.nome_corso ?? ""
          }`
            .toLowerCase()
            .includes(t),
        )
      : filtrate;
    return cercate.sort((a, b) =>
      (a.data_scadenza_calcolata ?? "").localeCompare(b.data_scadenza_calcolata ?? ""),
    );
  }, [attestati, vista, q, reparto]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-5 py-4">
          <Link to="/" aria-label="Torna alla home">
            <ArrowLeft className="size-5 text-muted-foreground" />
          </Link>
          <span className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Scadenze attestati</h1>
            <p className="text-xs text-muted-foreground">
              {righe.length} risultati · {vista}
            </p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] px-5 py-6">
        <div className="flex flex-wrap items-center gap-2">
          {(["Scaduti", "In scadenza (90 gg)", "Tutti con scadenza"] as Vista[]).map((v) => (
            <Button
              key={v}
              variant={vista === v ? "default" : "outline"}
              size="sm"
              onClick={() => setVista(v)}
            >
              {v}
            </Button>
          ))}
          <Select value={reparto} onValueChange={setReparto}>
            <SelectTrigger className="ml-auto w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TUTTI}>Tutti i reparti</SelectItem>
              {reparti.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative min-w-[220px] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cerca dipendente o corso"
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Caricamento…
          </div>
        ) : (
          <div className="mt-4 overflow-auto rounded-2xl border border-border bg-surface shadow-[var(--shadow-card)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Dipendente</th>
                  <th className="px-3 py-2">Codice fiscale</th>
                  <th className="px-3 py-2">Reparto</th>
                  <th className="px-3 py-2">Corso</th>
                  <th className="px-3 py-2">Data corso</th>
                  <th className="px-3 py-2">Scadenza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {righe.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2 font-medium">
                      {a.dipendenti?.cognome} {a.dipendenti?.nome}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{a.codice_fiscale}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {a.dipendenti?.reparto ?? "—"}
                    </td>
                    <td className="px-3 py-2">{a.tipi_corso?.nome_corso ?? "—"}</td>
                    <td className="px-3 py-2">{formatData(a.data_corso)}</td>
                    <td
                      className={`px-3 py-2 ${
                        scaduto(a.data_scadenza_calcolata)
                          ? "font-semibold text-destructive"
                          : "text-warning-foreground"
                      }`}
                    >
                      {formatData(a.data_scadenza_calcolata)}
                    </td>
                  </tr>
                ))}
                {!righe.length && (
                  <tr>
                    <td colSpan={6} className="px-3 py-12 text-center text-muted-foreground">
                      Nessun attestato in questa vista
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

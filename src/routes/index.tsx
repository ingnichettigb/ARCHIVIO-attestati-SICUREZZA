import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  ShieldCheck,
  Smartphone,
  Monitor,
  Copy,
  Check,
  FileCheck2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { BackupBar } from "@/components/BackupBar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Archivio Attestati Sicurezza — D.Lgs. 81/2008" },
      {
        name: "description",
        content:
          "Archivio digitale degli attestati di formazione sulla sicurezza: caricamento da cellulare, validazione HR e scadenze calcolate in automatico.",
      },
      { property: "og:title", content: "Archivio Attestati Sicurezza" },
      {
        property: "og:description",
        content:
          "Carica gli attestati dal telefono, valida dalla dashboard HR e tieni sotto controllo tutte le scadenze.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const [qr, setQr] = useState<string>("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const url = `${window.location.origin}/carica`;
    setLink(url);
    QRCode.toDataURL(url, { width: 320, margin: 1 }).then(setQr);
  }, []);

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const [dip, attesa, scaduti, tot] = await Promise.all([
        supabase.from("dipendenti").select("id", { count: "exact", head: true }),
        supabase
          .from("attestati_caricati")
          .select("id", { count: "exact", head: true })
          .eq("stato_validazione", "In attesa"),
        supabase
          .from("attestati_caricati")
          .select("id", { count: "exact", head: true })
          .lt("data_scadenza_calcolata", new Date().toISOString().slice(0, 10)),
        supabase
          .from("attestati_caricati")
          .select("id", { count: "exact", head: true }),
      ]);
      return {
        dipendenti: dip.count ?? 0,
        attesa: attesa.count ?? 0,
        scaduti: scaduti.count ?? 0,
        attestati: tot.count ?? 0,
      };
    },
  });

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-semibold">Archivio Attestati Sicurezza</h1>
              <p className="text-xs text-muted-foreground">D.Lgs. 81/2008</p>
            </div>
          </div>
          <BackupBar />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Dipendenti"
            value={stats?.dipendenti}
            icon={ShieldCheck}
            to="/dipendenti"
          />
          <StatCard
            label="Attestati"
            value={stats?.attestati}
            icon={FileCheck2}
            to="/hr"
          />
          <StatCard
            label="In attesa di validazione"
            value={stats?.attesa}
            icon={Clock}
            tone="warning"
            to="/hr"
          />
          <StatCard
            label="Scaduti"
            value={stats?.scaduti}
            icon={AlertTriangle}
            tone="destructive"
            to="/scadenze"
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/dipendenti">Gestione dipendenti</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/scadenze">Attestati scaduti</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/hr">Dashboard HR</Link>
          </Button>
          <Button asChild>
            <Link to="/operatore">Postazione Operatore (lettura automatica)</Link>
          </Button>
        </div>


        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
            <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Smartphone className="size-5" />
            </span>
            <h2 className="mt-4 text-xl font-semibold">Modulo lavoratore</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Il lavoratore compila cognome, nome, codice fiscale, data e luogo di
              nascita, sceglie il corso e allega la foto dell'attestato dal telefono.
            </p>
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
              {qr && (
                <img
                  src={qr}
                  alt="QR code per il modulo lavoratore"
                  className="size-32 rounded-lg border border-border bg-white p-1"
                />
              )}
              <div className="flex-1 space-y-3">
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs break-all text-muted-foreground">
                  {link}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link to="/carica">Apri il modulo</Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(link);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }}
                  >
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    {copied ? "Copiato" : "Copia link"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
            <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Monitor className="size-5" />
            </span>
            <h2 className="mt-4 text-xl font-semibold">Dashboard HR</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Elenco filtrabile per stato, vista affiancata con dati modificabili e
              visualizzatore immagini con zoom. Approvazione o respingimento con note
              obbligatorie e notifica email simulata.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li>• Modifica tipo corso, data e ore dichiarate</li>
              <li>• Scadenza ricalcolata automaticamente</li>
              <li>• Storico completo per dipendente</li>
            </ul>
            <Button asChild className="mt-6">
              <Link to="/hr">Apri la dashboard</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  to,
}: {
  label: string;
  value?: number | undefined;
  icon: typeof ShieldCheck;
  tone?: "warning" | "destructive";
  to: "/dipendenti" | "/scadenze" | "/hr";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning-foreground"
      : tone === "destructive"
        ? "text-destructive"
        : "text-primary";
  return (
    <Link
      to={to}
      className="block rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)] transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`size-4 ${toneClass}`} />
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums">
        {value ?? "—"}
      </p>
    </Link>
  );
}

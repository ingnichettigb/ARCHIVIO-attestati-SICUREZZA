import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  aggiornaRuolo,
  aggiungiRuolo,
  eliminaRuolo,
  getCategorieCorso,
  getRuoliSicurezza,
} from "@/lib/api";

/** Scheda Impostazioni: elenco ruoli/incarichi, aggiungibili in autonomia. */
export function RuoliTab() {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: ruoli = [], isLoading, error } = useQuery({
    queryKey: ["ruoli-sicurezza"],
    queryFn: getRuoliSicurezza,
    retry: false,
  });
  const { data: categorie = [] } = useQuery({ queryKey: ["categorie-corso"], queryFn: getCategorieCorso });

  const refresh = () => qc.invalidateQueries({ queryKey: ["ruoli-sicurezza"] });

  async function aggiungi() {
    setBusy(true);
    try {
      await aggiungiRuolo({
        nome,
        macro_categoria: categoria || null,
        ordine: ruoli.reduce((m, r) => Math.max(m, r.ordine), 0) + 1,
      });
      setNome("");
      setCategoria("");
      refresh();
      toast.success("Ruolo aggiunto");
    } catch (e) {
      toast.error("Ruolo non aggiunto", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function modifica(id: string, patch: Parameters<typeof aggiornaRuolo>[1]) {
    try {
      await aggiornaRuolo(id, patch);
      refresh();
    } catch (e) {
      toast.error("Modifica non riuscita", { description: (e as Error).message });
    }
  }

  async function rimuovi(id: string, n: string) {
    if (!window.confirm(`Eliminare il ruolo "${n}"? Verrà tolto anche ai dipendenti a cui era assegnato.`)) return;
    try {
      await eliminaRuolo(id);
      refresh();
      qc.invalidateQueries({ queryKey: ["dipendenti-ruoli"] });
    } catch (e) {
      toast.error("Eliminazione non riuscita", { description: (e as Error).message });
    }
  }

  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ruoli e incarichi di sicurezza da spuntare nella scheda di ogni dipendente. Collega il ruolo
        a una categoria di corsi per vedere subito se la formazione è fatta o mancante.
      </p>
      <datalist id="categorie-ruolo">
        {categorie.map((c) => (
          <option key={c.macro_categoria} value={c.macro_categoria} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-[180px] flex-1"
          placeholder="Nuovo ruolo (es. RLS, Carrellista)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <Input
          className="min-w-[160px] flex-1"
          list="categorie-ruolo"
          placeholder="Categoria corso (facoltativa)"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        />
        <Button onClick={aggiungi} disabled={busy || !nome.trim()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Aggiungi
        </Button>
      </div>
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {ruoli.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.nome}</p>
                <Input
                  className="mt-1 h-8 text-xs"
                  list="categorie-ruolo"
                  placeholder="Categoria corso collegata"
                  defaultValue={r.macro_categoria ?? ""}
                  onBlur={(e) => {
                    const v = e.target.value.trim() || null;
                    if (v !== r.macro_categoria) modifica(r.id, { macro_categoria: v });
                  }}
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch
                  checked={r.obbligatorio_tutti}
                  onCheckedChange={(v) => modifica(r.id, { obbligatorio_tutti: v })}
                />
                Per tutti
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch checked={r.attivo} onCheckedChange={(v) => modifica(r.id, { attivo: v })} />
                Attivo
              </label>
              <Button size="icon" variant="ghost" onClick={() => rimuovi(r.id, r.nome)} title="Elimina ruolo">
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
          {!ruoli.length && <li className="px-3 py-3 text-sm text-muted-foreground">Nessun ruolo.</li>}
        </ul>
      )}
    </div>
  );
}

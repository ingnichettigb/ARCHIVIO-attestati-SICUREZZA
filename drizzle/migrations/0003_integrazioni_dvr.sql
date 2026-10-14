CREATE TABLE IF NOT EXISTS public.integrazioni_dvr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dipendente_id uuid NOT NULL REFERENCES public.dipendenti(id) ON DELETE CASCADE,
  attestato_origine_id uuid REFERENCES public.attestati_caricati(id) ON DELETE SET NULL,
  tipo_corso_nome text,
  descrizione text NOT NULL,
  ore numeric,
  argomenti_mancanti text[] NOT NULL DEFAULT '{}',
  stato text NOT NULL DEFAULT 'Da completare',
  data_richiesta date NOT NULL DEFAULT current_date,
  attestato_chiusura_id uuid REFERENCES public.attestati_caricati(id) ON DELETE SET NULL,
  data_chiusura timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS integrazioni_dvr_dipendente_idx ON public.integrazioni_dvr (dipendente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrazioni_dvr TO anon, authenticated;
GRANT ALL ON public.integrazioni_dvr TO service_role;
ALTER TABLE public.integrazioni_dvr ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "integrazioni_dvr_public_all" ON public.integrazioni_dvr;
CREATE POLICY "integrazioni_dvr_public_all" ON public.integrazioni_dvr
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
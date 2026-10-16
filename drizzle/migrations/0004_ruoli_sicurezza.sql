CREATE TABLE IF NOT EXISTS public.ruoli_sicurezza (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descrizione text,
  macro_categoria text,
  obbligatorio_tutti boolean NOT NULL DEFAULT false,
  attivo boolean NOT NULL DEFAULT true,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.dipendenti_ruoli (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dipendente_id uuid NOT NULL REFERENCES public.dipendenti(id) ON DELETE CASCADE,
  ruolo_id uuid NOT NULL REFERENCES public.ruoli_sicurezza(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(dipendente_id, ruolo_id)
);
CREATE INDEX IF NOT EXISTS idx_dipendenti_ruoli_dip ON public.dipendenti_ruoli(dipendente_id);
GRANT ALL ON public.ruoli_sicurezza TO anon, authenticated, service_role;
GRANT ALL ON public.dipendenti_ruoli TO anon, authenticated, service_role;
ALTER TABLE public.ruoli_sicurezza ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dipendenti_ruoli ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ruoli_sicurezza_public_all" ON public.ruoli_sicurezza FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dipendenti_ruoli_public_all" ON public.dipendenti_ruoli FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
INSERT INTO public.ruoli_sicurezza (nome, macro_categoria, obbligatorio_tutti, ordine) VALUES
  ('Lavoratore', 'Sicurezza Lavoratori', true, 1),
  ('Preposto', 'Preposto', false, 2),
  ('Addetto Primo Soccorso', 'Primo Soccorso', false, 3),
  ('Addetto Antincendio', 'Antincendio', false, 4),
  ('Addetto BLSD / Defibrillatore', 'Defibrillatore', false, 5)
ON CONFLICT (nome) DO NOTHING;
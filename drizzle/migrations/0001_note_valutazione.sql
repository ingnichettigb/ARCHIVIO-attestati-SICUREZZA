CREATE TABLE IF NOT EXISTS public.note_valutazione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  testo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS note_valutazione_testo_uniq
  ON public.note_valutazione (lower(testo));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_valutazione TO anon, authenticated;
GRANT ALL ON public.note_valutazione TO service_role;

ALTER TABLE public.note_valutazione ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "note_valutazione_public_all" ON public.note_valutazione;
CREATE POLICY "note_valutazione_public_all" ON public.note_valutazione
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.coda_valutazioni'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%esito%'
  LOOP
    EXECUTE format('ALTER TABLE public.coda_valutazioni DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
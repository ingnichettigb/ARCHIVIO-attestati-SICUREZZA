CREATE TABLE public.documenti_attestati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dipendente_id uuid NOT NULL REFERENCES public.dipendenti(id) ON DELETE CASCADE,
  codice_fiscale varchar NOT NULL,
  tipo_attestato text NOT NULL,
  tipo_personalizzato text,
  data_scadenza date NOT NULL,
  nome_file text NOT NULL,
  percorso_file text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documenti_attestati TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documenti_attestati TO authenticated;
GRANT ALL ON public.documenti_attestati TO service_role;

ALTER TABLE public.documenti_attestati ENABLE ROW LEVEL SECURITY;

CREATE POLICY documenti_attestati_public_all ON public.documenti_attestati
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_documenti_attestati_dipendente ON public.documenti_attestati(dipendente_id);

CREATE TRIGGER trg_doc_upd BEFORE UPDATE ON public.documenti_attestati
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS attestati_storage_all ON storage.objects;
CREATE POLICY attestati_storage_all ON storage.objects
  FOR ALL TO anon, authenticated
  USING (bucket_id = 'attestati') WITH CHECK (bucket_id = 'attestati');
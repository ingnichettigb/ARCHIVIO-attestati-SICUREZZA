CREATE TABLE public.dipendenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice_fiscale varchar(16) NOT NULL UNIQUE,
  cognome text NOT NULL,
  nome text NOT NULL,
  email text,
  reparto text,
  luogo_nascita text,
  data_nascita date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dipendenti TO anon, authenticated;
GRANT ALL ON public.dipendenti TO service_role;
ALTER TABLE public.dipendenti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dipendenti_public_all" ON public.dipendenti FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.tipi_corso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_corso text NOT NULL,
  macro_categoria text NOT NULL,
  livello_specifico text NOT NULL,
  ore_minime_legge numeric,
  durata_validita_anni integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipi_corso TO anon, authenticated;
GRANT ALL ON public.tipi_corso TO service_role;
ALTER TABLE public.tipi_corso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tipi_corso_public_all" ON public.tipi_corso FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.attestati_caricati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dipendente_id uuid NOT NULL REFERENCES public.dipendenti(id) ON DELETE CASCADE,
  codice_fiscale varchar(16) NOT NULL REFERENCES public.dipendenti(codice_fiscale) ON UPDATE CASCADE,
  tipo_corso_id uuid NOT NULL REFERENCES public.tipi_corso(id),
  data_corso date NOT NULL,
  data_scadenza_calcolata date,
  ore_dichiarate numeric,
  url_foto_fronte text,
  url_foto_retro text,
  stato_validazione text NOT NULL DEFAULT 'In attesa',
  note_rifiuto text,
  data_validazione timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attestati_caricati TO anon, authenticated;
GRANT ALL ON public.attestati_caricati TO service_role;
ALTER TABLE public.attestati_caricati ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attestati_public_all" ON public.attestati_caricati FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_attestati_dip ON public.attestati_caricati(dipendente_id);
CREATE INDEX idx_attestati_stato ON public.attestati_caricati(stato_validazione);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_dip_upd BEFORE UPDATE ON public.dipendenti FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_tipi_upd BEFORE UPDATE ON public.tipi_corso FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.calcola_scadenza() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_anni integer;
BEGIN
  SELECT durata_validita_anni INTO v_anni FROM public.tipi_corso WHERE id = NEW.tipo_corso_id;
  IF v_anni IS NULL OR v_anni = 0 THEN
    NEW.data_scadenza_calcolata := NULL;
  ELSE
    NEW.data_scadenza_calcolata := (NEW.data_corso + (v_anni || ' years')::interval)::date;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_att_scadenza BEFORE INSERT OR UPDATE ON public.attestati_caricati FOR EACH ROW EXECUTE FUNCTION public.calcola_scadenza();

INSERT INTO public.tipi_corso (id, nome_corso, macro_categoria, livello_specifico, ore_minime_legge, durata_validita_anni) VALUES
('11111111-1111-4111-8111-000000000001','Sicurezza Generale','Sicurezza Lavoratori','Base',4,NULL),
('11111111-1111-4111-8111-000000000002','Sicurezza Specifica Rischio Basso','Sicurezza Lavoratori','Specifico',4,5),
('11111111-1111-4111-8111-000000000003','Antincendio Livello 1 Base','Antincendio','Base',4,5),
('11111111-1111-4111-8111-000000000004','Primo Soccorso Gruppo B/C Base','Primo Soccorso','Base',12,3),
('11111111-1111-4111-8111-000000000005','Aggiornamento Lavoratori','Sicurezza Lavoratori','Aggiornamento',6,5),
('11111111-1111-4111-8111-000000000006','Preposto','Preposto','Specifico',8,2),
('11111111-1111-4111-8111-000000000007','Uso del DAE (BLSD)','Primo Soccorso','Specifico',5,2),
('11111111-1111-4111-8111-000000000008','Prova di Evacuazione / Emergenze','Emergenze','Base',1,NULL);

CREATE POLICY "attestati_storage_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'attestati');
CREATE POLICY "attestati_storage_insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'attestati');
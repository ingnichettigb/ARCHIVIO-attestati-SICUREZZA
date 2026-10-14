ALTER TABLE public.dipendenti ADD COLUMN IF NOT EXISTS codice_ateco text;
ALTER TABLE public.coda_valutazioni ADD COLUMN IF NOT EXISTS codice_ateco text;
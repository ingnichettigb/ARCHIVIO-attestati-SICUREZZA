// All'inizio dei relativi import:
import { contaPagine, estraiPagine, piuSimile, somiglianza, renderizzaPrimaPaginaPdf } from "@/lib/pdf-pagine";

// Dentro il componente, la funzione scegliFile:
  async function scegliFile(f: File) {
    if (!(f.type === "application/pdf" || f.type.startsWith("image/"))) return void toast.error("Carica un PDF o una foto");
    setFile(f);
    setAnteprima(URL.createObjectURL(f));
    setAnteprimaMime(f.type);
    sorgenteRef.current = f; setRotazione(0);
    setIdInModifica(null);
    setForm(VUOTA);
    setPagine(""); setTestoLetto(""); setSuggerito(null);
    setTotPagine(f.type === "application/pdf" ? await contaPagine(f).catch(() => 0) : 0);
    setLettura(true);

    try {
      // Determina se l'AI attiva accetta direttamente i file PDF
      const accettaPdfDiretto =
        aiAttiva.kind === "default" ||
        aiAttiva.id.includes("gemini") ||
        aiAttiva.model.toLowerCase().includes("gemini");

      let payloadBase64 = "";
      let payloadMime = f.type;

      if (f.type === "application/pdf" && !accettaPdfDiretto) {
        // Conversione automatica in immagine per Groq, Mistral, OpenAI, ecc.
        toast.info("Conversione pagina PDF in immagine per l'AI in uso...");
        const img = await renderizzaPrimaPaginaPdf(f);
        payloadBase64 = img.base64;
        payloadMime = img.mime;
      } else {
        payloadBase64 = await fileToBase64(f);
      }

      const r = await estraiAttestato({
        data: {
          base64: payloadBase64,
          mime: payloadMime,
          nomeFile: f.name,
          tipiCorso: tipi.map((t) => t.nome_corso),
          argomenti,
          aiConfig: { kind: aiAttiva.kind, baseUrl: aiAttiva.baseUrl, model: aiAttiva.model, apiKey: aiAttiva.apiKey },
        },
      });
      if (!r.ok) return void toast.error(r.errore);
      const d = r.dati;
      setTestoLetto(d.tipo_corso);
      const tipo = tipi.find((t) => t.nome_corso.toLowerCase() === d.tipo_corso.toLowerCase()) ?? piuSimile(d.tipo_corso, tipi).tipo;
      setSuggerito(tipo?.id ?? null);
      const { data: esistente } = d.codice_fiscale
        ? await sb.from("dipendenti").select("*").eq("codice_fiscale", pulisciCF(d.codice_fiscale)).maybeSingle()
        : { data: null };
      setForm({
        ...VUOTA,
        cognome: d.cognome.toUpperCase(), nome: d.nome.toUpperCase(), codice_fiscale: pulisciCF(d.codice_fiscale),
        data_nascita: d.data_nascita, luogo_nascita: d.luogo_nascita,
        codice_ateco: d.codice_ateco || esistente?.codice_ateco || "",
        email: esistente?.email ?? "", reparto: esistente?.reparto ?? "",
        tipo_corso_id: tipo?.id ?? null, tipo_corso_nome: tipo?.nome_corso ?? d.tipo_corso,
        data_corso: d.data_corso, ore: d.ore, ente: d.ente, argomenti: d.argomenti,
        esito: d.valutazione, note: d.motivazione,
        integrazione: d.valutazione === "Valido con integrazione DVR" ? (integrazioni[0] ?? "") : "",
      });
      toast.success(esistente ? "Dati letti — dipendente già presente in archivio" : "Dati letti: controllali a fianco del documento");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLettura(false);
    }
  }

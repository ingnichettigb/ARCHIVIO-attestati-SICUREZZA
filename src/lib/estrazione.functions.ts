import { createServerFn } from "@tanstack/react-start";

export type DatiEstratti = {
  cognome: string;
  nome: string;
  codice_fiscale: string;
  data_nascita: string;
  luogo_nascita: string;
  codice_ateco: string;
  tipo_corso: string;
  data_corso: string;
  ore: number | null;
  ente: string;
  argomenti: string[];
  valutazione: "Valido" | "Valido con integrazione DVR" | "Non valido";
  motivazione: string;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    cognome: { type: "string" },
    nome: { type: "string" },
    codice_fiscale: { type: "string" },
    data_nascita: { type: "string", description: "AAAA-MM-GG o vuoto" },
    luogo_nascita: { type: "string" },
    codice_ateco: { type: "string", description: "Codice/i ATECO presenti sull'attestato (es. 85.31.20), separati da virgola, o vuoto" },
    tipo_corso: { type: "string", description: "Uno dei tipi di corso forniti, oppure il titolo letto" },
    data_corso: { type: "string", description: "Data di fine corso/rilascio AAAA-MM-GG o vuoto" },
    ore: { type: ["number", "null"] },
    ente: { type: "string" },
    argomenti: { type: "array", items: { type: "string" } },
    valutazione: { type: "string", enum: ["Valido", "Valido con integrazione DVR", "Non valido"] },
    motivazione: { type: "string" },
  },
  required: [
    "cognome", "nome", "codice_fiscale", "data_nascita", "luogo_nascita", "codice_ateco", "tipo_corso",
    "data_corso", "ore", "ente", "argomenti", "valutazione", "motivazione",
  ],
};

export const estraiAttestato = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { base64: string; mime: string; nomeFile: string; tipiCorso: string[]; argomenti: string[] }) => d,
  )
  .handler(async ({ data }): Promise<{ ok: true; dati: DatiEstratti } | { ok: false; errore: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, errore: "Chiave AI non configurata" };
    const isPdf = data.mime === "application/pdf";
    const media = isPdf
      ? { type: "input_file", filename: data.nomeFile || "attestato.pdf", file_data: `data:application/pdf;base64,${data.base64}` }
      : { type: "input_image", image_url: `data:${data.mime};base64,${data.base64}` };
    const prompt = `Sei un esperto di formazione sicurezza (D.Lgs. 81/2008, Accordo Stato-Regioni). Leggi l'attestato ed estrai i dati.
Tipi di corso disponibili (scegli il più adatto, testo identico): ${data.tipiCorso.join(" | ")}
Argomenti noti (riusa questi nomi quando corrispondono, aggiungine altri se presenti): ${data.argomenti.join(" | ")}
Valuta: "Valido" se ore e contenuti rispettano i minimi di legge; "Valido con integrazione DVR" se riconoscibile ma servono integrazioni (es. 4 o 8 ore per rischio medio/alto); "Non valido" se ore insufficienti, mancano firme/ente o illeggibile. Motivazione breve in italiano. Campi non leggibili = stringa vuota.`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "attestato", strict: true, schema: SCHEMA } },
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }, media] }],
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      if (res.status === 402) return { ok: false, errore: "Crediti AI esauriti: ricarica dalle impostazioni dello spazio di lavoro." };
      if (res.status === 429) return { ok: false, errore: "Troppe richieste, riprova tra poco." };
      return { ok: false, errore: `Errore lettura (${res.status}) ${t.slice(0, 200)}` };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const righe = buf.split("\n");
      buf = righe.pop() ?? "";
      for (const r of righe) {
        if (!r.startsWith("data:")) continue;
        const p = r.slice(5).trim();
        if (!p || p === "[DONE]") continue;
        try {
          const ev = JSON.parse(p);
          if (ev.type === "response.output_text.delta") out += ev.delta;
          if (ev.type === "error" || ev.type === "response.failed")
            return { ok: false, errore: ev.error?.message ?? ev.response?.error?.message ?? "Errore AI" };
        } catch {
          /* ignora */
        }
      }
    }
    try {
      return { ok: true, dati: JSON.parse(out) as DatiEstratti };
    } catch {
      return { ok: false, errore: "Documento non leggibile" };
    }
  });

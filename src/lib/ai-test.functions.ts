import { createServerFn } from "@tanstack/react-start";
import { messaggioErrore } from "./ai-providers";

/** Ping minimo per verificare chiave e modello di un fornitore compatibile OpenAI. */
export const testaFornitoreAi = createServerFn({ method: "POST" })
  .inputValidator((d: { baseUrl: string; model: string; apiKey: string }) => d)
  .handler(async ({ data }): Promise<{ ok: boolean; messaggio: string }> => {
    if (!data.apiKey.trim()) return { ok: false, messaggio: "Inserisci prima la chiave." };
    try {
      const res = await fetch(`${data.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.apiKey.trim()}` },
        body: JSON.stringify({ model: data.model, messages: [{ role: "user", content: "Rispondi OK" }], max_tokens: 5 }),
      });
      if (res.ok) return { ok: true, messaggio: "Chiave valida e pronta!" };
      return { ok: false, messaggio: messaggioErrore(res.status, data.model) };
    } catch (e) {
      return { ok: false, messaggio: `Fornitore non raggiungibile: ${(e as Error).message}` };
    }
  });

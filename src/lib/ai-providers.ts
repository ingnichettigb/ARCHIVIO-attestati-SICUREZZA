import { useEffect, useState } from "react";

export type AIProviderKind = "default" | "openai";

export interface AIProvider {
  id: string;
  name: string;
  kind: AIProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
  note: string;
  keyUrl?: string;
  supportaVisione: boolean;
  isCustom?: boolean;
}

export interface AIConfig {
  activeId: string;
  providers: AIProvider[];
}

export const DEFAULT_PROVIDERS: AIProvider[] = [
  {
    id: "lovable-default",
    name: "AI integrata (crediti Lovable)",
    kind: "default",
    baseUrl: "",
    model: "integrato",
    apiKey: "",
    note: "Predefinita. Usa i crediti AI mensili dello spazio di lavoro.",
    supportaVisione: true,
  },
  {
    id: "google-gemini-2.0-flash",
    name: "Google AI Studio – Gemini 2.0 Flash (gratis)",
    kind: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    apiKey: "",
    note: "Consigliato: veloce, gratuito e legge PDF e foto.",
    keyUrl: "https://aistudio.google.com/app/apikey",
    supportaVisione: true,
  },
  {
    id: "google-gemini-2.5-flash",
    name: "Google AI Studio – Gemini 2.5 Flash",
    kind: "openai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.5-flash",
    apiKey: "",
    note: "Disponibile solo per account abilitati su Google AI Studio.",
    keyUrl: "https://aistudio.google.com/app/apikey",
    supportaVisione: true,
  },
  {
    id: "openai-gpt4o-mini",
    name: "OpenAI – GPT-4o-mini (chiave personale)",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    apiKey: "",
    note: "Richiede una chiave OpenAI con credito proprio. Legge le foto.",
    keyUrl: "https://platform.openai.com/api-keys",
    supportaVisione: true,
  },
  {
    id: "openrouter-free",
    name: "OpenRouter (modelli gratuiti)",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "google/gemini-2.0-flash-exp:free",
    apiKey: "",
    note: "Aggregatore con modelli gratuiti che leggono le immagini.",
    keyUrl: "https://openrouter.ai/keys",
    supportaVisione: true,
  },
];

const STORAGE_KEY = "archivio_attestati_ai_config_v1";
const DEFAULT_CONFIG: AIConfig = { activeId: "lovable-default", providers: DEFAULT_PROVIDERS };

export function loadAiConfig(): AIConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AIConfig>;
    const salvati = parsed.providers ?? [];
    const merged: AIProvider[] = DEFAULT_PROVIDERS.map((def) => {
      const m = salvati.find((s) => s.id === def.id);
      return m
        ? {
            ...def,
            name: m.name || def.name,
            baseUrl: m.baseUrl || def.baseUrl,
            apiKey: m.apiKey || "",
            model: m.model || def.model,
          }
        : def;
    });
    for (const p of salvati) if (p.isCustom && !merged.some((m) => m.id === p.id)) merged.push(p);
    const activeId = parsed.activeId && merged.some((m) => m.id === parsed.activeId) ? parsed.activeId : "lovable-default";
    return { activeId, providers: merged };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveAiConfig(cfg: AIConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  window.dispatchEvent(new Event("ai-changed"));
}

export function resetAiConfig() {
  saveAiConfig(DEFAULT_CONFIG);
}

export function getActiveProvider(cfg: AIConfig): AIProvider {
  return cfg.providers.find((p) => p.id === cfg.activeId) ?? cfg.providers[0] ?? DEFAULT_PROVIDERS[0]!;
}

/** Configurazione AI reattiva; letta dal browser dopo il primo render. */
export function useAiConfig(): [AIConfig, (cfg: AIConfig) => void] {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  useEffect(() => {
    setConfig(loadAiConfig());
    const h = () => setConfig(loadAiConfig());
    window.addEventListener("ai-changed", h);
    return () => window.removeEventListener("ai-changed", h);
  }, []);
  return [config, (c: AIConfig) => { saveAiConfig(c); setConfig(c); }];
}

export function messaggioErrore(status: number, model: string) {
  if (status === 401 || status === 403) return "Chiave non valida o senza permessi.";
  if (status === 429) return "Limite gratuito o quota superata: riprova più tardi o passa a un'altra AI.";
  if (status === 404) return `Modello "${model}" non disponibile su questo fornitore.`;
  return `Errore del fornitore (${status}).`;
}

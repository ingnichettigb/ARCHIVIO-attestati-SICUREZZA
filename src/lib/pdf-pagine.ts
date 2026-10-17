import { PDFDocument } from "pdf-lib";

/** Converte "1-2, 4" in indici 0-based validi (vuoto = tutte). */
export function parsePagine(testo: string, totale: number): number[] {
  const out = new Set<number>();
  for (const parte of testo.split(/[,;\s]+/).filter(Boolean)) {
    const m = parte.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]), b = Number(m[2] ?? m[1]);
    for (let p = Math.min(a, b); p <= Math.max(a, b); p++) if (p >= 1 && p <= totale) out.add(p - 1);
  }
  return [...out].sort((x, y) => x - y);
}

export async function contaPagine(file: Blob): Promise<number> {
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  return doc.getPageCount();
}

/** Nuovo PDF con le sole pagine richieste. */
export async function estraiPagine(file: Blob, indici: number[]): Promise<Blob> {
  const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const pagine = await out.copyPages(src, indici);
  pagine.forEach((p) => out.addPage(p));
  const bytes = await out.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/**
 * Converte la prima pagina di un PDF in un'immagine PNG (base64 puro) nel browser.
 * Utilizzato per i fornitori AI (come Groq o Mistral) che accettano solo immagini e non PDF nativi.
 */
export async function renderizzaPrimaPaginaPdf(file: Blob): Promise<{ base64: string; mime: string }> {
  const dataUrl = await renderizzaPaginaPdf(file, 1, 2);
  return { base64: dataUrl.split(",")[1] ?? "", mime: "image/png" };
}

/** Renderizza una pagina (1-based) del PDF come dataURL PNG. */
export async function renderizzaPaginaPdf(file: Blob, numero: number, scala = 2.5): Promise<string> {
  // Carica PDF.js da CDN se non già presente nel DOM
  const w = window as unknown as { pdfjsLib?: any };
  if (!w.pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        w.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve();
      };
      script.onerror = () => reject(new Error("Impossibile caricare il convertitore PDF"));
      document.head.appendChild(script);
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = w.pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(Math.min(Math.max(1, numero), pdfDoc.numPages));
  const viewport = page.getViewport({ scale: scala });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Errore inizializzazione canvas grafico");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

export async function _vecchiaRender(file: Blob): Promise<{ base64: string; mime: string }> {
  const w = window as unknown as { pdfjsLib?: any };
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = w.pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(1);

  // Scala 2.0 per garantire una perfetta leggibilità dei caratteri piccoli dell'attestato
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Errore inizializzazione canvas grafico");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({ canvasContext: ctx, viewport }).promise;

  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.split(",")[1] ?? "";
  return { base64, mime: "image/png" };
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9/ ]/g, " ");
const STOP = new Set(["di", "per", "il", "la", "e", "del", "dei", "al", "ai", "corso", "formazione", "modulo", "d", "lgs", "art", "ex", "81", "08", "2008"]);
const parole = (s: string) => norm(s).split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));

/** Punteggio di somiglianza 0..1 tra testo letto e nome corso codificato. */
export function somiglianza(letto: string, codificato: string): number {
  const a = parole(letto), b = parole(codificato);
  if (!a.length || !b.length) return 0;
  if (norm(letto).trim() === norm(codificato).trim()) return 1;
  const match = b.filter((w) => a.some((x) => x === w || (x.length > 3 && w.length > 3 && (x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5)))))).length;
  return match / b.length * 0.8 + match / Math.max(a.length, b.length) * 0.2;
}

export function piuSimile<T extends { nome_corso: string }>(letto: string, tipi: T[]): { tipo: T | null; punteggio: number } {
  let best: T | null = null, score = 0;
  for (const t of tipi) {
    const s = somiglianza(letto, t.nome_corso);
    if (s > score) { score = s; best = t; }
  }
  return { tipo: score >= 0.3 ? best : null, punteggio: score };
}

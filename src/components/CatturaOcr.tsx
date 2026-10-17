/*
 * Visualizzatore con selezione a rettangolo + OCR locale (Tesseract, gratuito, nel browser).
 */
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { renderizzaPaginaPdf } from "@/lib/pdf-pagine";
import { Button } from "@/components/ui/button";

interface Props {
  file: Blob;
  isPdf: boolean;
  totPagine: number;
  etichettaCampo: string;
  onTesto: (testo: string) => void;
}

type Rett = { x: number; y: number; w: number; h: number };

let workerPromise: Promise<any> | null = null;
async function getWorker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js").then((T) => T.createWorker("ita+eng"));
  }
  return workerPromise;
}

export function CatturaOcr({ file, isPdf, totPagine, etichettaCampo, onTesto }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [rett, setRett] = useState<Rett | null>(null);
  const [occupato, setOccupato] = useState(false);
  const inizio = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let url: string | null = null;
    let annullato = false;
    (async () => {
      setSrc(null);
      if (isPdf) {
        const d = await renderizzaPaginaPdf(file, pagina).catch(() => null);
        if (!annullato) setSrc(d);
      } else {
        url = URL.createObjectURL(file);
        setSrc(url);
      }
    })();
    return () => { annullato = true; if (url) URL.revokeObjectURL(url); };
  }, [file, isPdf, pagina]);

  function pos(e: React.PointerEvent) {
    const r = imgRef.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(r.width, e.clientX - r.left)), y: Math.max(0, Math.min(r.height, e.clientY - r.top)) };
  }

  async function termina() {
    const r = rett;
    inizio.current = null;
    const img = imgRef.current;
    if (!r || !img || r.w < 5 || r.h < 5) return setRett(null);
    const kx = img.naturalWidth / img.clientWidth, ky = img.naturalHeight / img.clientHeight;
    const canvas = document.createElement("canvas");
    const scala = 2;
    canvas.width = r.w * kx * scala; canvas.height = r.h * ky * scala;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, r.x * kx, r.y * ky, r.w * kx, r.h * ky, 0, 0, canvas.width, canvas.height);
    setOccupato(true);
    try {
      const worker = await getWorker();
      const { data } = await worker.recognize(canvas);
      onTesto(String(data.text ?? "").replace(/\s+/g, " ").trim());
    } catch {
      onTesto("");
    } finally {
      setOccupato(false);
      setRett(null);
    }
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs border-b bg-primary/10">
        <span>Trascina un rettangolo sul testo → <b>{etichettaCampo}</b></span>
        {isPdf && totPagine > 1 && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>‹</Button>
            <span>Pag. {pagina}/{totPagine}</span>
            <Button size="sm" variant="outline" disabled={pagina >= totPagine} onClick={() => setPagina(pagina + 1)}>›</Button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto p-2 flex justify-center">
        {!src ? (
          <Loader2 className="size-6 animate-spin m-auto text-primary" />
        ) : (
          <div
            className="relative inline-block cursor-crosshair select-none touch-none"
            onPointerDown={(e) => { const p = pos(e); inizio.current = p; setRett({ x: p.x, y: p.y, w: 0, h: 0 }); (e.target as Element).setPointerCapture?.(e.pointerId); }}
            onPointerMove={(e) => {
              if (!inizio.current) return;
              const p = pos(e), s = inizio.current;
              setRett({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
            }}
            onPointerUp={termina}
          >
            <img ref={imgRef} src={src} alt="Documento" draggable={false} className="max-w-full h-auto block" />
            {rett && (
              <div className="absolute border-2 border-primary bg-primary/20 pointer-events-none"
                style={{ left: rett.x, top: rett.y, width: rett.w, height: rett.h }} />
            )}
            {occupato && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center gap-2 text-sm">
                <Loader2 className="size-5 animate-spin" /> Lettura testo...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

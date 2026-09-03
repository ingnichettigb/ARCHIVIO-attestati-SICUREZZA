import { useEffect, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fotoUrl } from "@/lib/api";

export function ImageViewer({
  fronte,
  retro,
}: {
  fronte: string | null;
  retro: string | null;
}) {
  const [urls, setUrls] = useState<{ f: string | null; r: string | null }>({
    f: null,
    r: null,
  });
  const [lato, setLato] = useState<"fronte" | "retro">("fronte");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let active = true;
    setZoom(1);
    setLato("fronte");
    Promise.all([fotoUrl(fronte), fotoUrl(retro)]).then(([f, r]) => {
      if (active) setUrls({ f, r });
    });
    return () => {
      active = false;
    };
  }, [fronte, retro]);

  const src = lato === "fronte" ? urls.f : urls.r;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border bg-surface p-1">
          {(["fronte", "retro"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLato(l);
                setZoom(1);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                lato === l
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            aria-label="Riduci zoom"
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="w-14 text-center text-sm tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
            aria-label="Aumenta zoom"
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setZoom(1)}
            aria-label="Reimposta zoom"
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-80 flex-1 items-center justify-center overflow-auto rounded-xl border border-border bg-muted/40 p-3">
        {src ? (
          <img
            src={src}
            alt={`Attestato ${lato}`}
            style={{ transform: `scale(${zoom})` }}
            className="max-h-[65vh] w-auto max-w-full origin-center object-contain transition-transform"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <ImageOff className="size-8" />
            Nessuna immagine {lato} caricata
          </div>
        )}
      </div>
    </div>
  );
}

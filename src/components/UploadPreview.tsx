import { useEffect, useState } from "react";
import { Camera, X } from "lucide-react";

export function UploadPreview({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const id = `upload-${label.replace(/\s/g, "-")}`;

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {preview ? (
        <div className="relative overflow-hidden rounded-xl border border-border bg-surface">
          <img
            src={preview}
            alt={`Anteprima ${label}`}
            className="max-h-64 w-full object-contain"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Rimuovi immagine"
            className="absolute right-2 top-2 rounded-full bg-foreground/70 p-2 text-background"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface p-6 text-center text-sm text-muted-foreground transition-colors hover:border-primary/60 hover:bg-accent/40"
        >
          <Camera className="size-7 text-primary" />
          Tocca per scattare o scegliere una foto
        </label>
      )}
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

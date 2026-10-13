import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

export type Suggerimento = {
  valore: string;
  dettaglio?: string | null;
};

interface CampoSuggeritoProps {
  value: string;
  onChange: (value: string) => void;
  suggerimenti: Suggerimento[];
  placeholder?: string;
  maiuscolo?: boolean;
  className?: string;
  disabled?: boolean;
}

export function CampoSuggerito({
  value,
  onChange,
  suggerimenti,
  placeholder,
  maiuscolo,
  className,
  disabled,
}: CampoSuggeritoProps) {
  const [aperto, setAperto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAperto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const valoreNorm = (value ?? "").trim().toLowerCase();
  const filtrati = suggerimenti
    .filter(
      (s) =>
        !valoreNorm ||
        s.valore.toLowerCase().includes(valoreNorm) ||
        (s.dettaglio && s.dettaglio.toLowerCase().includes(valoreNorm)),
    )
    .slice(0, 15);

  function handleChange(testo: string) {
    const val = maiuscolo ? testo.toUpperCase() : testo;
    onChange(val);
    setAperto(true);
  }

  function handleSelect(val: string) {
    onChange(maiuscolo ? val.toUpperCase() : val);
    setAperto(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setAperto(true)}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="off"
      />
      {aperto && filtrati.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
          {filtrati.map((s) => (
            <li
              key={s.valore}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(s.valore);
              }}
              className="flex cursor-pointer items-center justify-between rounded px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <span className="font-medium">{s.valore}</span>
              {s.dettaglio && (
                <span className="ml-2 truncate text-xs text-muted-foreground">
                  {s.dettaglio}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

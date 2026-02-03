"use client";

import * as React from "react";
import { TokenIcon, ChainIcon } from "@/components/TokenIcon";

interface TokenOption {
  value: string;
  label: string;
  symbol?: string;
}

interface ChainOption {
  value: number;
  label: string;
  chainId: number;
}

interface TokenSelectProps {
  value: string;
  options: TokenOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

interface ChainSelectProps {
  value: number;
  options: ChainOption[];
  onChange: (value: number) => void;
  placeholder?: string;
}

export function TokenSelect({ value, options, onChange, placeholder = "Select token" }: TokenSelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-9 flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {selected ? (
            <>
              <TokenIcon symbol={selected.symbol || selected.value} size={16} />
              <span>{selected.label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
          <div className="max-h-48 overflow-y-auto p-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                  value === option.value ? "bg-primary/10" : "hover:bg-muted"
                }`}
              >
                <TokenIcon symbol={option.symbol || option.value} size={18} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ChainSelect({ value, options, onChange, placeholder = "Select chain" }: ChainSelectProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-9 flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {selected ? (
            <>
              <ChainIcon chainId={selected.chainId} size={16} />
              <span>{selected.label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
          <div className="max-h-48 overflow-y-auto p-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                  value === option.value ? "bg-primary/10" : "hover:bg-muted"
                }`}
              >
                <ChainIcon chainId={option.chainId} size={18} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import type { AiProvider } from "@/lib/ai-provider";
import { PROVIDER_MODELS, PROVIDER_LABELS } from "@/lib/ai-provider";
import { CaretDown } from "@phosphor-icons/react";

interface ChatModelSwitcherProps {
  connectedProviders: AiProvider[];
  selectedProvider: AiProvider;
  selectedModel: string;
  onChange: (provider: AiProvider, model: string) => void;
}

export function ChatModelSwitcher({
  connectedProviders,
  selectedProvider,
  selectedModel,
  onChange,
}: ChatModelSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const currentLabel = PROVIDER_MODELS[selectedProvider]?.find((m) => m.id === selectedModel)?.label ?? selectedModel;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors bg-muted/50 rounded-md px-2 py-1"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        <span className="max-w-[120px] truncate">{currentLabel}</span>
        <CaretDown size={10} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-1 w-56 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-10">
          {connectedProviders.map((provider) => (
            <div key={provider}>
              <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30" style={{ fontFamily: "var(--font-mono)" }}>
                {PROVIDER_LABELS[provider]}
              </p>
              {PROVIDER_MODELS[provider]?.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { onChange(provider, m.id); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    provider === selectedProvider && m.id === selectedModel
                      ? "text-foreground bg-muted"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

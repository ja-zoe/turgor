"use client";

import { useState } from "react";
import type { AiProvider } from "@/lib/ai-provider";
import { PROVIDER_LABELS, DEFAULT_MODELS } from "@/lib/ai-provider";

interface Connection {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

interface ChatProviderSetupProps {
  connections: Connection[];
  onConnect: (provider: AiProvider, apiKey: string, model: string) => void;
  onDisconnect: (provider: AiProvider) => void;
}

const PROVIDERS: { id: AiProvider; initials: string; color: string; description: string }[] = [
  { id: "anthropic", initials: "An", color: "#CC785C", description: "Claude models by Anthropic" },
  { id: "openai", initials: "Oa", color: "#10A37F", description: "GPT-4o by OpenAI" },
  { id: "google", initials: "G", color: "#4285F4", description: "Gemini models by Google" },
  { id: "copilot", initials: "Co", color: "#24292F", description: "GitHub Copilot (OpenAI-compatible)" },
  { id: "deepseek", initials: "Ds", color: "#4B6EF5", description: "DeepSeek models" },
];

export function ChatProviderSetup({ connections, onConnect, onDisconnect }: ChatProviderSetupProps) {
  const [tab, setTab] = useState<"connect" | "mine">("connect");
  const [expanded, setExpanded] = useState<AiProvider | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function isConnected(p: AiProvider) {
    return connections.some((c) => c.provider === p);
  }

  async function handleConnect(provider: AiProvider) {
    const key = apiKey.trim();
    if (!key) {
      setError("API key is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const model = DEFAULT_MODELS[provider];
      const res = await fetch("/api/ai/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, apiKey: key, model }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Verification failed — check your API key.");
        return;
      }
      onConnect(provider, key, model);
      setApiKey("");
      setExpanded(null);
    } catch {
      setError("Network error — could not reach the verification endpoint.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-border shrink-0">
        {(["connect", "mine"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors ${
              tab === t
                ? "text-foreground border-b-2 border-[#2E4034]"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {t === "connect" ? "Connect" : "My connections"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "connect" && (
          <div className="space-y-2">
            {PROVIDERS.map((p) => (
              <div key={p.id} className="border border-border rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: p.color + "20" }}
                  >
                    <span className="text-xs font-bold" style={{ color: p.color }}>{p.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{PROVIDER_LABELS[p.id]}</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                  {isConnected(p.id) && (
                    <span className="text-xs text-[#588157] bg-[#EDF3EC] px-1.5 py-0.5 rounded" style={{ fontFamily: "var(--font-mono)" }}>
                      Connected
                    </span>
                  )}
                </button>

                {expanded === p.id && (
                  <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/10">
                    {/* OAuth coming soon */}
                    <button
                      disabled
                      className="w-full text-xs text-muted-foreground border border-border rounded-lg py-2 cursor-not-allowed opacity-50"
                      title="OAuth coming soon — use an API key for now"
                    >
                      Sign in with OAuth (coming soon)
                    </button>

                    <div>
                      <label className="text-xs text-muted-foreground block mb-1" style={{ fontFamily: "var(--font-mono)" }}>
                        API Key
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Paste your API key…"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[#2E4034]/30"
                        style={{ fontFamily: "var(--font-mono)" }}
                      />
                      {error && <p className="text-xs text-[#A4503C] mt-1">{error}</p>}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleConnect(p.id)}
                      disabled={loading}
                      className="w-full rounded-lg bg-[#2E4034] text-white text-xs font-medium py-2 hover:bg-[#2E4034]/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading && (
                        <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                      )}
                      {loading ? "Verifying…" : "Connect"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "mine" && (
          <div className="space-y-2">
            {connections.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No providers connected yet.
              </p>
            ) : (
              connections.map((c) => {
                const pInfo = PROVIDERS.find((p) => p.id === c.provider);
                return (
                  <div key={c.provider} className="flex items-center gap-3 border border-border rounded-xl px-4 py-3">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: (pInfo?.color ?? "#888") + "20" }}
                    >
                      <span className="text-xs font-bold" style={{ color: pInfo?.color }}>{pInfo?.initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{PROVIDER_LABELS[c.provider]}</p>
                      <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>{c.model}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDisconnect(c.provider)}
                      className="text-xs text-muted-foreground hover:text-[#A4503C] transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

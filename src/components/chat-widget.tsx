"use client";

// Integration note for layout.tsx:
// Add these two lines to src/app/(app)/layout.tsx to enable the chat widget:
//   import { ChatWidget } from "@/components/chat-widget";
//   <ChatWidget />  ← place just before the closing </div> of the outer flex div

import { useState, useEffect, useRef, useMemo } from "react";
import { useChat, Chat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ChatCircleDots,
  Question,
  GearSix,
  MinusCircle,
  PaperPlaneTilt,
  Robot,
} from "@phosphor-icons/react";
import type { AiProvider } from "@/lib/ai-provider";
import { DEFAULT_MODELS } from "@/lib/ai-provider";
import { ChatOnboarding } from "./chat-onboarding";
import { ChatProviderSetup } from "./chat-provider-setup";
import { ChatModelSwitcher } from "./chat-model-switcher";

interface Connection {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeProvider, setActiveProvider] = useState<AiProvider | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keep latest connection state in refs so the chat transport body stays current
  // without recreating the Chat object on every re-render.
  const activeProviderRef = useRef<AiProvider | null>(null);
  const activeModelRef = useRef<string | null>(null);
  const connectionsRef = useRef<Connection[]>([]);

  activeProviderRef.current = activeProvider;
  activeModelRef.current = activeModel;
  connectionsRef.current = connections;

  // Create the Chat object once. The body function reads from refs so it always
  // reflects the current provider/key/model without needing a new Chat instance.
  const chat = useMemo(
    () =>
      new Chat({
        transport: new DefaultChatTransport({
          api: "/api/chat",
          body: () => {
            const conn = connectionsRef.current.find(
              (c) => c.provider === activeProviderRef.current
            );
            return {
              provider: activeProviderRef.current,
              apiKey: conn?.apiKey,
              model: activeModelRef.current,
            };
          },
        }),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { messages, status, sendMessage } = useChat({ chat });
  const isLoading = status === "submitted" || status === "streaming";

  // Restore open state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("seed_chat_open");
    if (stored === "true") setIsOpen(true);
    const onboarded = localStorage.getItem("seed_chat_onboarded");
    if (!onboarded) setShowOnboarding(true);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function toggleOpen() {
    const next = !isOpen;
    setIsOpen(next);
    localStorage.setItem("seed_chat_open", String(next));
  }

  function handleConnect(provider: AiProvider, apiKey: string, model: string) {
    setConnections((prev) => {
      const filtered = prev.filter((c) => c.provider !== provider);
      return [...filtered, { provider, apiKey, model }];
    });
    setActiveProvider(provider);
    setActiveModel(model);
    setShowSetup(false);
  }

  function handleDisconnect(provider: AiProvider) {
    setConnections((prev) => {
      const remaining = prev.filter((c) => c.provider !== provider);
      if (activeProvider === provider) {
        setActiveProvider(remaining[0]?.provider ?? null);
        setActiveModel(remaining[0]?.model ?? null);
      }
      return remaining;
    });
  }

  function handleModelChange(provider: AiProvider, model: string) {
    setConnections((prev) =>
      prev.map((c) => (c.provider === provider ? { ...c, model } : c))
    );
    setActiveProvider(provider);
    setActiveModel(model);
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");
    sendMessage({ text });
  }

  const activeConnection = connections.find((c) => c.provider === activeProvider);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[#2E4034] text-white shadow-lg flex items-center justify-center hover:bg-[#2E4034]/80 transition-colors"
        title="Open SEED Assistant"
      >
        <ChatCircleDots size={22} weight="fill" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[540px] bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <Robot size={15} className="text-[#2E4034]" weight="fill" />
        <span className="text-sm font-medium text-foreground flex-1">SEED Assistant</span>

        {activeProvider && activeModel && (
          <ChatModelSwitcher
            connectedProviders={connections.map((c) => c.provider)}
            selectedProvider={activeProvider}
            selectedModel={activeModel}
            onChange={handleModelChange}
          />
        )}

        <button
          type="button"
          onClick={() => { setShowOnboarding(true); setShowSetup(false); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="About SEED Assistant"
        >
          <Question size={15} />
        </button>
        <button
          type="button"
          onClick={() => { setShowSetup(true); setShowOnboarding(false); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Manage connections"
        >
          <GearSix size={15} />
        </button>
        <button
          type="button"
          onClick={toggleOpen}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Minimize"
        >
          <MinusCircle size={15} />
        </button>
      </div>

      {/* Body */}
      {showOnboarding ? (
        <ChatOnboarding onComplete={() => setShowOnboarding(false)} />
      ) : showSetup || connections.length === 0 ? (
        <ChatProviderSetup
          connections={connections}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center pt-8">
                Ask me to create action items, draft status updates, or summarize project state.
              </p>
            )}
            {messages.map((m) => {
              // Extract text content from UIMessage parts (AI SDK v7 format)
              const textContent = m.parts
                .filter((p): p is { type: "text"; text: string } => p.type === "text")
                .map((p) => p.text)
                .join("");

              // Extract tool invocations from parts
              const toolParts = m.parts.filter(
                (p) =>
                  p.type === "dynamic-tool" ||
                  (typeof p.type === "string" && p.type.startsWith("tool-"))
              ) as Array<{ type: string; toolName?: string; state?: string }>;

              return (
                <div
                  key={m.id}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#2E4034] text-white"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {textContent}
                    {toolParts.map((t, i) => (
                      <div
                        key={i}
                        className="mt-1.5 pt-1.5 border-t border-border/40 text-[10px] opacity-70"
                        style={{ fontFamily: "var(--font-mono)" }}
                      >
                        ↳ {t.toolName ?? t.type.replace("tool-", "")}
                        {t.state === "output" || t.state === "result" ? ": done" : "…"}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-3 py-2 flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer */}
          <div className="border-t border-border px-3 py-2.5 flex items-end gap-2 shrink-0">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={activeConnection ? "Ask me anything…" : "Connect a model first"}
              disabled={!activeConnection}
              rows={1}
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none disabled:opacity-50"
              style={{ maxHeight: "80px" }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!activeConnection || !input.trim() || isLoading}
              className="shrink-0 w-7 h-7 rounded-lg bg-[#2E4034] text-white flex items-center justify-center hover:bg-[#2E4034]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PaperPlaneTilt size={13} weight="fill" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export type AiProvider = "anthropic" | "openai" | "copilot" | "deepseek" | "google";

export const PROVIDER_MODELS: Record<AiProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (fast)" },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6 (balanced)" },
    { id: "claude-opus-4-8", label: "Opus 4.8 (powerful)" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini (fast)" },
    { id: "gpt-4o", label: "GPT-4o (balanced)" },
  ],
  copilot: [
    { id: "gpt-4o-mini", label: "GPT-4o mini (fast)" },
    { id: "gpt-4o", label: "GPT-4o (balanced)" },
  ],
  google: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (fast)" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (powerful)" },
  ],
  deepseek: [
    { id: "deepseek-chat", label: "DeepSeek Chat" },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner" },
  ],
};

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
  copilot: "gpt-4o-mini",
  google: "gemini-2.0-flash",
  deepseek: "deepseek-chat",
};

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "ChatGPT (OpenAI)",
  google: "Gemini (Google)",
  copilot: "GitHub Copilot",
  deepseek: "DeepSeek",
};

export function resolveModel(provider: AiProvider, apiKey: string, model: string) {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "copilot":
      return createOpenAI({ apiKey, baseURL: "https://api.githubcopilot.com/v1" })(model);
    case "deepseek":
      return createOpenAI({ apiKey, baseURL: "https://api.deepseek.com/v1" })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
  }
}

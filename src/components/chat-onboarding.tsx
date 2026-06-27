"use client";

import { useState } from "react";
import { ArrowRight, Lightning, CurrencyDollar, Lock } from "@phosphor-icons/react";

interface ChatOnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    icon: Lightning,
    title: "What I can do",
    body: "Create action items, draft status updates, plan timelines, and more — all within your role's permissions in SEED.",
  },
  {
    icon: CurrencyDollar,
    title: "Your AI, your cost",
    body: "Connect Claude, ChatGPT, Gemini, Copilot, or DeepSeek using your own account. The university pays nothing.",
  },
  {
    icon: Lock,
    title: "Your key stays yours",
    body: "Your API key is sent directly from your browser to the AI provider. It's never logged or stored by this app.",
  },
];

export function ChatOnboarding({ onComplete }: ChatOnboardingProps) {
  const [step, setStep] = useState(0);

  function advance() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem("seed_chat_onboarded", "true");
      onComplete();
    }
  }

  function skip() {
    localStorage.setItem("seed_chat_onboarded", "true");
    onComplete();
  }

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div className="flex flex-col flex-1 items-center justify-center p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-[#2E4034]/10 flex items-center justify-center mb-5">
        <Icon size={22} className="text-[#2E4034]" weight="fill" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-2">{current.title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed mb-8 max-w-[260px]">{current.body}</p>

      <div className="flex items-center gap-2 mb-5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              i === step ? "w-4 bg-[#2E4034]" : "w-1.5 bg-[#2E4034]/20"
            }`}
          />
        ))}
      </div>

      <button
        onClick={advance}
        className="flex items-center gap-1.5 rounded-lg bg-[#2E4034] text-white text-xs font-medium px-4 py-2 hover:bg-[#2E4034]/80 transition-colors mb-3"
      >
        {step < STEPS.length - 1 ? "Next" : "Get started"}
        <ArrowRight size={12} />
      </button>
      <button
        onClick={skip}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Skip all
      </button>
    </div>
  );
}

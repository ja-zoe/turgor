"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownEditorProps {
  /** Field name for `<form>` submission (uncontrolled usage). Optional when controlled. */
  name?: string;
  defaultValue?: string;
  /** Controlled value — when provided, the editor is controlled and calls `onChange`. */
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  allowToggle?: boolean;
  /** Optional test id applied to the inner textarea. */
  textareaTestId?: string;
}

export function MarkdownEditor({
  name,
  defaultValue = "",
  value: controlledValue,
  onChange,
  placeholder = "Write Markdown here…",
  rows = 6,
  required,
  allowToggle = true,
  textareaTestId,
}: MarkdownEditorProps) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const value = isControlled ? controlledValue : internalValue;
  const setValue = (v: string) => {
    if (isControlled) onChange?.(v);
    else setInternalValue(v);
  };
  const [preview, setPreview] = useState(false);
  const [mode, setMode] = useState<"md" | "plain">("md");

  function switchToPlain() {
    setMode("plain");
    setPreview(false);
  }

  function switchToMd() {
    setMode("md");
  }

  const modeToggle = allowToggle ? (
    <div className="flex items-center gap-0.5 mr-2 ml-auto">
      <button
        type="button"
        onClick={switchToMd}
        className={`cursor-pointer text-xs transition-colors ${
          mode === "md"
            ? "text-foreground bg-muted rounded px-1.5 py-0.5"
            : "text-muted-foreground px-1.5 py-0.5 hover:text-foreground"
        }`}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        MD
      </button>
      <button
        type="button"
        onClick={switchToPlain}
        className={`cursor-pointer text-xs transition-colors ${
          mode === "plain"
            ? "text-foreground bg-muted rounded px-1.5 py-0.5"
            : "text-muted-foreground px-1.5 py-0.5 hover:text-foreground"
        }`}
        style={{ fontFamily: "var(--font-mono)" }}
      >
        Plain
      </button>
    </div>
  ) : null;

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border bg-card">
        {mode === "md" && (
          <>
            <button
              type="button"
              onClick={() => setPreview(false)}
              className={`cursor-pointer px-4 py-2 text-xs font-medium transition-colors ${
                !preview
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setPreview(true)}
              className={`cursor-pointer px-4 py-2 text-xs font-medium transition-colors ${
                preview
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Preview
            </button>
          </>
        )}
        {modeToggle}
      </div>

      {/* Editor / Preview area */}
      {mode === "md" && preview ? (
        <div
          className="p-3 min-h-[100px] prose prose-sm max-w-none text-foreground"
          style={{ minHeight: `${rows * 1.5}rem` }}
        >
          {value ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground italic">Nothing to preview.</p>
          )}
        </div>
      ) : (
        <textarea
          name={name}
          data-testid={textareaTestId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            mode === "plain" ? "Write a plain-text description…" : placeholder
          }
          rows={rows}
          required={required}
          className="w-full p-3 bg-background text-sm text-foreground placeholder:text-muted-foreground/60 resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
          style={
            mode === "md"
              ? { fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }
              : { fontFamily: "inherit", fontSize: "0.8125rem" }
          }
        />
      )}
    </div>
  );
}

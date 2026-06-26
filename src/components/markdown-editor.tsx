"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownEditorProps {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
}

export function MarkdownEditor({
  name,
  defaultValue = "",
  placeholder = "Write Markdown here…",
  rows = 6,
  required,
}: MarkdownEditorProps) {
  const [value, setValue] = useState(defaultValue);
  const [preview, setPreview] = useState(false);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border bg-card">
        <button
          type="button"
          onClick={() => setPreview(false)}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
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
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            preview
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          Preview
        </button>
      </div>

      {/* Editor / Preview area */}
      {preview ? (
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
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          required={required}
          className="w-full p-3 bg-background text-sm text-foreground placeholder:text-muted-foreground/60 resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
          style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem" }}
        />
      )}
    </div>
  );
}

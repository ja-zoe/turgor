import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders Markdown (GFM) as HTML. Plain text renders unchanged, so it's safe for
 * "Markdown or plain" description fields. No typography plugin is installed, so a
 * few element styles are bridged via arbitrary variants for compact, muted contexts.
 */
export function MarkdownView({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "max-w-none break-words",
        "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_strong]:font-semibold [&_em]:italic",
        "[&_a]:text-primary [&_a]:underline",
        "[&_code]:font-mono [&_code]:text-[0.95em]",
        "[&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5",
        "[&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold",
        className,
      ].join(" ")}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

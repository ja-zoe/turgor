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
        "[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1 [&_h1:first-child]:mt-0",
        "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1 [&_h2:first-child]:mt-0",
        "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-0.5 [&_h3:first-child]:mt-0",
        "[&_h4]:text-sm [&_h4]:font-medium [&_h5]:text-sm [&_h5]:font-medium [&_h6]:text-sm [&_h6]:font-medium",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:my-1 [&_blockquote]:text-muted-foreground",
        "[&_hr]:border-border [&_hr]:my-2",
        "[&_pre]:bg-secondary [&_pre]:rounded [&_pre]:p-2 [&_pre]:my-1 [&_pre]:overflow-x-auto",
        className,
      ].join(" ")}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}

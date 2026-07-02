"use client";

import { useState } from "react";
import { Robot, Copy, Check, ArrowClockwise, Trash, Key } from "@phosphor-icons/react";
import { generateMcpToken, revokeMcpToken } from "@/lib/actions/account";
import { formatRelative } from "@/lib/utils";
import { ActionSpinner } from "@/components/action-feedback";

export interface McpConnectionDTO {
  type: "ACCESS_TOKEN" | "OAUTH";
  label: string | null;
  lastSeenAt: string; // ISO
}

interface Props {
  hasToken: boolean;
  appUrl: string;
  connections: McpConnectionDTO[];
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function MpcTokenSection({ hasToken, appUrl, connections }: Props) {
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenExists, setTokenExists] = useState(hasToken);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState<"generate" | "revoke" | null>(null);

  const mcpUrl = `${appUrl}/api/mcp`;

  const configJson = JSON.stringify(
    {
      mcpServers: {
        "seed-tracker": {
          url: mcpUrl,
          headers: { Authorization: `Bearer ${newToken ?? "<your-token>"}` },
        },
      },
    },
    null,
    2
  );

  async function handleGenerate() {
    setLoading("generate");
    try {
      const { token } = await generateMcpToken();
      setNewToken(token);
      setTokenExists(true);
    } finally {
      setLoading(null);
    }
  }

  async function handleRevoke() {
    setLoading("revoke");
    try {
      await revokeMcpToken();
      setNewToken(null);
      setTokenExists(false);
    } finally {
      setLoading(null);
    }
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyConfig() {
    await navigator.clipboard.writeText(configJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2">
        <Robot size={15} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">MCP Server</h2>
      </div>

      <div className="p-5 bg-card border border-border rounded-xl space-y-5">
        <div>
          <p className="text-sm text-foreground font-medium mb-1">Personal access token</p>
          <p className="text-xs text-muted-foreground">
            Generate a token and paste it into your MCP client (Claude Desktop, Cursor, etc.) to
            give your AI assistant read and write access to your SEED projects under your role
            permissions.
          </p>
        </div>

        {/* Connections — one line per live MCP connection (R18.1) */}
        <div className="space-y-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Connections
          </p>
          {connections.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-testid="mcp-no-connections">
              No active connections
            </p>
          ) : (
            <ul className="space-y-1.5" data-testid="mcp-connections">
              {connections.map((c, i) => {
                const recent = Date.now() - new Date(c.lastSeenAt).getTime() <= SEVEN_DAYS_MS;
                const Icon = c.type === "OAUTH" ? Robot : Key;
                const label =
                  c.label ?? (c.type === "OAUTH" ? "OAuth client" : "Personal access token");
                return (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-xs"
                    data-testid="mcp-connection"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        recent ? "bg-[#588157]" : "bg-muted-foreground/40"
                      }`}
                      title={recent ? "Active in the last 7 days" : "Idle"}
                    />
                    <Icon size={13} className="text-muted-foreground shrink-0" />
                    <span className="text-foreground">{label}</span>
                    <span
                      className="text-muted-foreground"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      last used {formatRelative(c.lastSeenAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Token controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading !== null}
            className="cursor-pointer flex items-center gap-1.5 text-xs font-medium text-foreground bg-[#2E4034] text-white rounded-md px-3 py-1.5 hover:bg-[#2E4034]/80 transition-colors disabled:opacity-50 disabled:cursor-default"
          >
            {loading === "generate" ? (
              <ActionSpinner size={13} />
            ) : (
              <ArrowClockwise size={13} />
            )}
            {tokenExists ? "Regenerate" : "Generate token"}
          </button>

          {tokenExists && (
            <button
              type="button"
              onClick={handleRevoke}
              disabled={loading !== null}
              className="flex items-center gap-1.5 text-xs text-muted-foreground clickable-danger disabled:opacity-50"
            >
              {loading === "revoke" ? <ActionSpinner size={13} /> : <Trash size={13} />}
              Revoke
            </button>
          )}
        </div>

        {/* Newly generated token — shown once */}
        {newToken && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Copy this token now — it will not be shown again after you leave this page.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-[#588157]/40 bg-[#EDF3EC]/50 px-3 py-2">
              <code
                data-testid="mcp-new-token"
                className="flex-1 text-xs text-foreground break-all"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {newToken}
              </code>
              <button
                type="button"
                onClick={copyToken}
                className="shrink-0 text-muted-foreground clickable-icon"
                title="Copy token"
              >
                {copied ? <Check size={14} className="text-[#588157]" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Client config */}
      <div className="p-5 bg-card border border-border rounded-xl space-y-4">
        <div>
          <p className="text-sm text-foreground font-medium mb-1">Client configuration</p>
          <p className="text-xs text-muted-foreground">
            Paste this into your MCP client config. In Claude Desktop:{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs" style={{ fontFamily: "var(--font-mono)" }}>
              claude_desktop_config.json
            </code>
            . In Cursor: MCP settings panel.
          </p>
        </div>

        <div className="relative">
          <pre
            className="text-xs rounded-lg border border-border bg-muted/50 p-4 overflow-x-auto"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            {configJson}
          </pre>
          <button
            type="button"
            onClick={copyConfig}
            className="absolute top-3 right-3 text-muted-foreground clickable-icon"
            title="Copy config"
          >
            {copied ? <Check size={14} className="text-[#588157]" /> : <Copy size={14} />}
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-foreground" style={{ fontFamily: "var(--font-mono)" }}>
            Available tools
          </p>
          {[
            {
              group: "Read",
              tools: [
                { name: "list_projects", desc: "all projects you have access to" },
                { name: "get_project_detail", desc: "deliverables, subtasks & open action items" },
                { name: "list_members", desc: "query members by project, role, or status" },
                { name: "list_action_items", desc: "filter action items by project or status" },
                { name: "get_my_subtasks", desc: "subtasks assigned to you" },
              ],
            },
            {
              group: "Projects (MANAGE_PROJECTS)",
              tools: [
                { name: "create_project", desc: "create a new project" },
                { name: "update_project", desc: "edit name, semester, dates, description, corrective action" },
              ],
            },
            {
              group: "Action items",
              tools: [
                { name: "create_action_item", desc: "create (LEAD/SUBLEAD or PM)" },
                { name: "update_action_item", desc: "close, reopen, or edit (LEAD/SUBLEAD or PM)" },
                { name: "delete_action_item", desc: "delete an action item (LEAD/SUBLEAD or PM)" },
              ],
            },
            {
              group: "Status",
              tools: [
                { name: "create_status_update", desc: "post weekly update (LEAD/SUBLEAD or PM)" },
              ],
            },
            {
              group: "Deliverables",
              tools: [
                { name: "create_deliverable", desc: "create (LEAD/SUBLEAD or PM)" },
                { name: "update_deliverable", desc: "edit title, dates, status, group (LEAD/SUBLEAD or PM)" },
                { name: "delete_deliverable", desc: "delete + all subtasks (PM only)" },
              ],
            },
            {
              group: "Subtasks",
              tools: [
                { name: "create_subtask", desc: "create (any project member or PM)" },
                { name: "update_subtask", desc: "edit title, dates, assignee, status (member or PM)" },
                { name: "delete_subtask", desc: "delete (LEAD/SUBLEAD or PM)" },
              ],
            },
            {
              group: "Calendar (read-open / write MANAGE_CALENDAR)",
              tools: [
                { name: "list_calendar_events", desc: "list events, filter by semester/date/type" },
                { name: "create_calendar_event", desc: "create an event (MANAGE_CALENDAR)" },
                { name: "update_calendar_event", desc: "edit an event (MANAGE_CALENDAR)" },
                { name: "delete_calendar_event", desc: "delete an event (MANAGE_CALENDAR)" },
              ],
            },
          ].map(({ group, tools }) => (
            <div key={group}>
              <p
                className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-1"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {group}
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5" style={{ fontFamily: "var(--font-mono)" }}>
                {tools.map((t) => (
                  <li key={t.name}>
                    <span className="text-foreground">{t.name}</span>
                    {" — "}
                    {t.desc}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

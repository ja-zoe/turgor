"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "@/lib/format";

/**
 * Recharts wrappers styled to the forest palette (§5.9). Soft gridlines, earthy
 * series colors, no harsh defaults — charts feel like part of the theme.
 *
 * These are client components (Recharts needs the DOM); pages pass already-
 * aggregated data computed on the server.
 */

const AXIS = { stroke: "var(--text-on-dark-soft)", fontSize: 12 };
const GRID = "rgba(163,176,135,0.12)";

function ChartTooltip({ active, payload, label, suffix }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ borderRadius: 14, padding: "8px 12px", fontSize: 12, background: "var(--sidebar)", color: "var(--text-on-dark)", border: "1px solid var(--border-on-dark)", boxShadow: "var(--shadow-dark)" }}>
      <p style={{ fontWeight: 500, marginBottom: 2, color: "var(--text-on-dark)" }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? "var(--text-on-dark-soft)" }}>
          {p.name}: {p.value}
          {suffix ?? ""}
        </p>
      ))}
    </div>
  );
}

/** Weekly goal-completion rate over the semester (% of weekly goals met). */
export function GoalCompletionChart({ data }: { data: { week: string; pct: number }[] }) {
  if (!data.length) return <Empty label="No goal data yet" />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="week" {...AXIS} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 100]} {...AXIS} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
        <Tooltip content={<ChartTooltip suffix="%" />} />
        <Line type="monotone" dataKey="pct" name="Goals met" stroke="#4ca876" strokeWidth={2.5} dot={{ r: 3, fill: "#9ab087" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bar chart of recurring blockers (§5.9). */
export function BlockerFrequencyChart({ data }: { data: { blocker: string; count: number }[] }) {
  if (!data.length) return <Empty label="No blockers logged" />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" {...AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="blocker" width={140} {...AXIS} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(76,168,118,0.08)" }} />
        <Bar dataKey="count" name="Occurrences" radius={[0, 6, 6, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Generic category bar chart (e.g. health distribution across projects). */
export function CategoryBarChart({
  data,
}: {
  data: { label: string; value: number; color?: string }[];
}) {
  if (!data.length) return <Empty label="Nothing to chart yet" />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...AXIS} tickLine={false} axisLine={false} />
        <YAxis {...AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(76,168,118,0.08)" }} />
        <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-on-dark-soft)" }}>
      {label}
    </div>
  );
}

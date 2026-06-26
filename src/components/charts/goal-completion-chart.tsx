"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface GoalDataPoint {
  week: string;
  goalMet: boolean | null;
}

interface GoalCompletionChartProps {
  data: GoalDataPoint[];
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2">
      <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">
        {value === 1 ? "Goal Met" : value === 0 ? "Goal Missed" : "N/A"}
      </p>
    </div>
  );
};

export function GoalCompletionChart({ data }: GoalCompletionChartProps) {
  const chartData = data.map((d) => ({
    week: d.week,
    value: d.goalMet === true ? 1 : d.goalMet === false ? 0 : 0.5,
    met: d.goalMet,
  }));

  if (chartData.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center">
        <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
          No meeting records yet
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={chartData} barSize={20} margin={{ top: 4, right: 4, bottom: 4, left: -24 }}>
        <CartesianGrid vertical={false} stroke="#E2E0D9" />
        <XAxis
          dataKey="week"
          tick={{ fill: "#787774", fontSize: 10, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide domain={[0, 1]} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.met === true ? "#588157" : entry.met === false ? "#A4503C" : "#D1CCBF"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

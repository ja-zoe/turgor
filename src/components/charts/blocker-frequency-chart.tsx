"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface BlockerFrequencyChartProps {
  data: { word: string; count: number }[];
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
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2">
      <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{payload[0].value} mentions</p>
    </div>
  );
};

export function BlockerFrequencyChart({ data }: BlockerFrequencyChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center">
        <p className="text-xs text-muted-foreground" style={{ fontFamily: "var(--font-mono)" }}>
          No blocker data
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
        barSize={14}
      >
        <CartesianGrid horizontal={false} stroke="#E2E0D9" />
        <XAxis
          type="number"
          tick={{ fill: "#787774", fontSize: 10, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="word"
          tick={{ fill: "#787774", fontSize: 11, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          width={90}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
        <Bar dataKey="count" fill="#6F4E37" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

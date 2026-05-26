import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { fmt } from "../math";
import { tooltipStyle, axisStyle } from "../ui";

interface BalancePoint {
  year: string;
  Standard: number;
  "With Extra"?: number;
}

interface PiPoint {
  year: string;
  Interest: number;
  Principal: number;
}

interface ChartsTabProps {
  balanceChartData: BalancePoint[];
  piChartData: PiPoint[];
  hasExtra: boolean;
}

export default function ChartsTab({ balanceChartData, piChartData, hasExtra }: ChartsTabProps) {
  const tickInterval = (data: unknown[]) => Math.floor(data.length / 6);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Remaining balance over time ── */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <h3 className="text-sm font-bold text-slate-200 mb-4">Remaining Balance Over Time</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={balanceChartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="gStd" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
              </linearGradient>
              <linearGradient id="gExtra" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={axisStyle} interval={tickInterval(balanceChartData)} />
            <YAxis tick={axisStyle} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={60} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [typeof v === "number" ? fmt(v) : v]} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
            <Area type="monotone" dataKey="Standard"   stroke="#6366f1" fill="url(#gStd)"   strokeWidth={2} dot={false} />
            {hasExtra && (
              <Area type="monotone" dataKey="With Extra" stroke="#10b981" fill="url(#gExtra)" strokeWidth={2} dot={false} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Interest vs Principal per year ── */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <h3 className="text-sm font-bold text-slate-200 mb-4">Interest vs Principal Per Year</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={piChartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={axisStyle} interval={tickInterval(piChartData)} />
            <YAxis tick={axisStyle} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} width={60} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [typeof v === "number" ? fmt(v) : v]} />
            <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
            <Bar dataKey="Interest"  stackId="a" fill="#f87171" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Principal" stackId="a" fill="#60a5fa" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

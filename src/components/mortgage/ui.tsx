import type React from "react";

export const inputCls =
  "w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 transition tabular-nums";
export const labelCls = "block text-xs text-slate-400 mb-1";

export const tooltipStyle = {
  backgroundColor: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 10,
  color: "#f1f5f9",
  fontSize: 12,
};
export const axisStyle = { fontSize: 11, fill: "#64748b" };

type CardColor = "default" | "indigo" | "emerald" | "amber" | "red";

export function Card({
  label,
  value,
  sub,
  color = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: CardColor;
}) {
  const bg: Record<CardColor, string> = {
    default: "bg-slate-900 border-slate-800",
    indigo:  "bg-indigo-900/40 border-indigo-700",
    emerald: "bg-emerald-900/30 border-emerald-800",
    amber:   "bg-amber-900/30 border-amber-800",
    red:     "bg-red-900/30 border-red-800",
  };
  const txt: Record<CardColor, string> = {
    default: "text-white",
    indigo:  "text-indigo-200",
    emerald: "text-emerald-200",
    amber:   "text-amber-200",
    red:     "text-red-200",
  };
  return (
    <div className={`p-4 rounded-2xl border ${bg[color]}`}>
      <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${txt[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer group w-fit select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-indigo-500 shrink-0"
      />
      <span className="text-sm text-slate-300 group-hover:text-slate-100 transition leading-snug">
        {children}
      </span>
    </label>
  );
}

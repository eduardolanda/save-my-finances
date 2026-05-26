import { fmt } from "../math";
import type { ScheduleResult } from "../types";

interface ScheduleTabProps {
  baseSchedule: ScheduleResult;
  extraSchedule: ScheduleResult | null;
  hasExtra: boolean;
  loan: number;
}

export default function ScheduleTab({
  baseSchedule,
  extraSchedule,
  hasExtra,
  loan,
}: ScheduleTabProps) {
  const schedule = extraSchedule ?? baseSchedule;

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
      <h3 className="text-sm font-bold text-slate-200 mb-3">
        📅 Yearly Amortization Table
        {hasExtra && (
          <span className="ml-2 text-xs text-emerald-400">· with extra payments</span>
        )}
      </h3>
      <table className="w-full text-sm text-left min-w-[500px]">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-700">
            <th className="pb-2 pr-4 font-medium">Year</th>
            <th className="pb-2 pr-4 font-medium text-right">Interest</th>
            <th className="pb-2 pr-4 font-medium text-right">Principal</th>
            {hasExtra && (
              <th className="pb-2 pr-4 font-medium text-right text-emerald-500">Extra</th>
            )}
            <th className="pb-2 font-medium text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {schedule.yearRows.map((yr) => (
            <tr
              key={yr.year}
              className="border-b border-slate-800/60 text-slate-300 hover:bg-slate-800/40"
            >
              <td className="py-2 pr-4 font-semibold text-slate-100">Yr {yr.year}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-red-400">{fmt(yr.interest)}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-blue-400">{fmt(yr.principal)}</td>
              {hasExtra && (
                <td className="py-2 pr-4 text-right tabular-nums text-emerald-400">
                  {yr.extra > 0 ? fmt(yr.extra) : "—"}
                </td>
              )}
              <td className="py-2 text-right tabular-nums">
                {yr.balance > 0 ? (
                  fmt(yr.balance)
                ) : (
                  <span className="text-emerald-400 font-semibold">Paid off ✓</span>
                )}
              </td>
            </tr>
          ))}

          {/* Totals row */}
          <tr className="text-xs text-slate-500 font-semibold border-t border-slate-700">
            <td className="pt-3 pr-4 text-slate-300">Totals</td>
            <td className="pt-3 pr-4 text-right tabular-nums text-red-400">
              {fmt(schedule.totalInterest)}
            </td>
            <td className="pt-3 pr-4 text-right tabular-nums text-blue-400">{fmt(loan)}</td>
            {hasExtra && (
              <td className="pt-3 pr-4 text-right tabular-nums text-emerald-400">
                {fmt(schedule.yearRows.reduce((s, y) => s + y.extra, 0))}
              </td>
            )}
            <td className="pt-3 text-right">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

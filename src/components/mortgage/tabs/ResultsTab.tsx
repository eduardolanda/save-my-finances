import { Card } from "../ui";
import { fmt, fmt2 } from "../math";
import type { PayFreq, ScheduleResult } from "../types";

const FREQ_LABEL: Record<PayFreq, string> = {
  monthly: "Monthly",
  "semi-monthly": "Semi-Monthly",
  "bi-weekly": "Bi-Weekly",
  weekly: "Weekly",
};
const FREQ_SHORT: Record<PayFreq, string> = {
  monthly: "mo",
  "semi-monthly": "semi-mo",
  "bi-weekly": "bi-wk",
  weekly: "wk",
};

interface ResultsTabProps {
  payFreq: PayFreq;
  pmt: number;
  pmtMonthlyEquiv: number;
  amort: number;
  downPayment: number;
  strata: number;
  roommate: number;
  grossMonthlyHousing: number;
  totalMonthlyHousing: number;
  totalUtilities: number;
  totalMonthlyCost: number;
  loan: number;
  cmhc: number;
  totalInterest: number;
  stressRate: number;
  stressPmt: number;
  monthlyLeft: number | null;
  housingRatio: number | null;
  totalMonthlyCommitted: number;
  monthlyExpenses: number;
  hasExtra: boolean;
  extra: number;
  payIncr: number;
  extraSchedule: ScheduleResult | null;
  interestSaved: number;
  monthsSaved: number;
  ppy: number;
}

export default function ResultsTab({
  payFreq,
  pmt,
  pmtMonthlyEquiv,
  amort,
  downPayment,
  strata,
  roommate,
  grossMonthlyHousing,
  totalMonthlyHousing,
  totalUtilities,
  totalMonthlyCost,
  loan,
  cmhc,
  totalInterest,
  stressRate,
  stressPmt,
  monthlyLeft,
  housingRatio,
  totalMonthlyCommitted,
  monthlyExpenses,
  hasExtra,
  extra,
  payIncr,
  extraSchedule,
  interestSaved,
  monthsSaved,
  ppy,
}: ResultsTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <Card
          label={`${FREQ_LABEL[payFreq]} Payment`}
          value={fmt2(pmt)}
          sub={
            roommate > 0 || strata > 0
              ? `Your share ≈${fmt2(totalMonthlyHousing)}/mo`
              : payFreq !== "monthly"
              ? `≈${fmt2(pmtMonthlyEquiv)}/mo`
              : undefined
          }
          color="indigo"
        />
        <Card
          label="Mortgage + Strata"
          value={fmt2(grossMonthlyHousing)}
          sub={strata > 0 ? `Mortgage ${fmt2(pmtMonthlyEquiv)} + Strata ${fmt2(strata)}` : "No strata set"}
        />
        <Card
          label="Your Net Payment"
          value={fmt2(totalMonthlyHousing)}
          sub={roommate > 0 ? `${fmt2(grossMonthlyHousing)} − Roommate ${fmt2(roommate)}` : "No roommate set"}
          color="indigo"
        />
        <Card
          label="Mortgage Amount"
          value={fmt(loan)}
          sub={cmhc > 0 ? `+${fmt(cmhc)} CMHC` : undefined}
        />
        <Card label="Total Interest" value={fmt(totalInterest)} color="red" />
        <Card label="Total Cost" value={fmt(pmtMonthlyEquiv * amort * 12 + downPayment)} />
        <Card
          label="Utilities"
          value={fmt2(totalUtilities)}
          sub={totalUtilities > 0 ? `/mo · ${fmt2(totalMonthlyCost)} all-in` : "No utilities set"}
        />
      </div>

      {/* ── Stress test ── */}
      <div className="p-4 rounded-2xl bg-amber-900/20 border border-amber-800/50 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <p className="text-xs text-amber-400 uppercase tracking-widest mb-0.5">
            ⚠️ Stress Test @ {(stressRate * 100).toFixed(2)}%
          </p>
          <p className="text-xl font-bold text-white tabular-nums">
            {fmt2(stressPmt)}{" "}
            <span className="text-sm font-normal text-slate-400">
              /{FREQ_SHORT[payFreq]}
            </span>
          </p>
        </div>
        <p className="text-xs text-slate-500 sm:max-w-xs leading-relaxed">
          OSFI requires qualifying at max(rate + 2%, 5.25%). Lenders use this to
          assess your affordability.
        </p>
      </div>

      {/* ── Monthly affordability ── */}
      {monthlyLeft !== null ? (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center gap-4 ${
            housingRatio! > 40
              ? "bg-rose-900/20 border-rose-800/50"
              : housingRatio! > 30
              ? "bg-amber-900/20 border-amber-800/50"
              : "bg-emerald-900/20 border-emerald-800/50"
          }`}
        >
          <div className="flex-1">
            <p
              className={`text-xs uppercase tracking-widest mb-1 ${
                housingRatio! > 40
                  ? "text-rose-400"
                  : housingRatio! > 30
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              💰 Monthly Left After All Expenses
            </p>
            <p className="text-xl font-bold text-white tabular-nums">
              {fmt2(monthlyLeft)}
              <span className="text-sm font-normal text-slate-400"> /mo</span>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {buildAffordabilityLine({
                pmtMonthlyEquiv,
                strata,
                grossMonthlyHousing,
                roommate,
                totalUtilities,
                monthlyExpenses,
                totalMonthlyCommitted,
              })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <p className="text-xs text-slate-400">Housing ratio</p>
            <p
              className={`text-2xl font-bold tabular-nums ${
                housingRatio! > 40
                  ? "text-rose-300"
                  : housingRatio! > 30
                  ? "text-amber-300"
                  : "text-emerald-300"
              }`}
            >
              {housingRatio!.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-600">Recommended &lt;30%</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-600 text-center py-1">
          Add income in the{" "}
          <strong className="text-slate-500">Income &amp; Expenses</strong> tab
          to see monthly affordability
        </p>
      )}

      {/* ── Extra payment impact ── */}
      {hasExtra && extraSchedule && (
        <div className="p-4 rounded-2xl bg-emerald-900/20 border border-emerald-800/50">
          <p className="text-xs text-emerald-400 uppercase tracking-widest mb-3">
            ✅ Impact
            {extra > 0 ? ` of ${fmt(extra)} lump sum` : ""}
            {payIncr > 0 ? ` + ${fmt2(payIncr)} payment increase` : ""}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card label="Interest Saved"    value={fmt(interestSaved)}                          color="emerald" />
            <Card label="Years Saved"       value={`${(monthsSaved / 12).toFixed(1)} yrs`}       color="emerald" sub={`${monthsSaved} months`} />
            <Card label="Payoff In"         value={`${(extraSchedule.payoffPeriod / ppy).toFixed(1)} yrs`} color="emerald" sub={`${extraSchedule.payoffPeriod} periods`} />
            <Card label="New Total Interest" value={fmt(extraSchedule.totalInterest)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function buildAffordabilityLine({
  pmtMonthlyEquiv,
  strata,
  grossMonthlyHousing,
  roommate,
  totalUtilities,
  monthlyExpenses,
  totalMonthlyCommitted,
}: {
  pmtMonthlyEquiv: number;
  strata: number;
  grossMonthlyHousing: number;
  roommate: number;
  totalUtilities: number;
  monthlyExpenses: number;
  totalMonthlyCommitted: number;
}): string {
  const parts = [`Mortgage ${fmt2(pmtMonthlyEquiv)}`];
  if (strata > 0) parts.push(`Strata ${fmt2(strata)}`);
  const gross = parts.join(" + ");
  let line = gross;
  if (roommate > 0)
    line = `(${gross} = ${fmt2(grossMonthlyHousing)}) − Roommate ${fmt2(roommate)}`;
  else if (strata > 0) line = gross;
  if (totalUtilities > 0) line += ` + Utilities ${fmt2(totalUtilities)}`;
  if (monthlyExpenses > 0) line += ` + Other expenses ${fmt2(monthlyExpenses)}`;
  line += ` = ${fmt2(totalMonthlyCommitted)}/mo`;
  return line;
}

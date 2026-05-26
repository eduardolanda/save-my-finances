import { useState, useMemo, useEffect } from "react";
import { PROVINCES } from "../mortgage/provinces";
import type { ProvinceCode } from "../mortgage/provinces";
import {
  calcTax,
  rrspLimit,
  getTaxTips,
  ZERO_DEDUCTIONS,
  TAX_DISCLAIMER,
  type DeductionInputs,
} from "./taxes";
import { formatMoney } from "../../currency";

// ── helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  formatMoney(Math.abs(n), "CAD").replace("CA", "").replace("C$", "$");

function pct(n: number) {
  return (n * 100).toFixed(1) + "%";
}

const inputCls =
  "w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 transition";
const labelCls = "block text-xs text-slate-400 mb-1";

// ── Deduction row ──────────────────────────────────────────────────────────────
function DeductionRow({
  label,
  hint,
  value,
  onChange,
  max,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {max !== undefined && (
          <span className="ml-1 text-slate-600">(max {fmt(max)})</span>
        )}
      </label>
      <input
        className={inputCls}
        value={value === 0 ? "" : value.toString()}
        onChange={(e) =>
          onChange(parseFloat(e.target.value.replace(/[^0-9.]/g, "")) || 0)
        }
        inputMode="decimal"
        placeholder="0"
      />
      <p className="text-xs text-slate-600 mt-0.5">{hint}</p>
    </div>
  );
}

// ── Tax bar visual ─────────────────────────────────────────────────────────────
function TaxBar({
  label,
  amount,
  total,
  color,
}: {
  label: string;
  amount: number;
  total: number;
  color: string;
}) {
  const pctVal = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-800">
        <div
          className={`h-2 rounded-full ${color} transition-all`}
          style={{ width: `${pctVal.toFixed(1)}%` }}
        />
      </div>
      <span className="text-xs text-slate-200 tabular-nums w-20 text-right shrink-0">
        {fmt(amount)}
      </span>
      <span className="text-xs text-slate-500 tabular-nums w-10 text-right shrink-0">
        {pctVal.toFixed(0)}%
      </span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface TaxPanelProps {
  province: ProvinceCode;
  monthlyGross: number; // from income flows
  monthlyGrossFlows: number; // gross-flagged flows only (reset target)
}

export default function TaxPanel({ province, monthlyGross, monthlyGrossFlows }: TaxPanelProps) {
  const annualGross = monthlyGross * 12;
  const annualGrossFlows = monthlyGrossFlows * 12;

  const [deductions, setDeductions] = useState<DeductionInputs>(() => {
    try {
      const stored = localStorage.getItem("vq-tax-deductions");
      return stored ? (JSON.parse(stored) as DeductionInputs) : ZERO_DEDUCTIONS;
    } catch {
      return ZERO_DEDUCTIONS;
    }
  });
  const [showDeductions, setShowDeductions] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [grossOverride, setGrossOverride] = useState(
    () => localStorage.getItem("vq-tax-grossOverride") ?? "",
  );

  useEffect(() => {
    localStorage.setItem("vq-tax-deductions", JSON.stringify(deductions));
  }, [deductions]);

  useEffect(() => {
    localStorage.setItem("vq-tax-grossOverride", grossOverride);
  }, [grossOverride]);

  // When flows change, clear any stale override so the new flows value takes effect
  useEffect(() => {
    setGrossOverride("");
  }, [annualGross]);

  const effectiveGross = grossOverride
    ? parseFloat(grossOverride.replace(/[^0-9.]/g, "")) || annualGross
    : annualGross;

  const result = useMemo(
    () => calcTax(effectiveGross, province, deductions),
    [effectiveGross, province, deductions],
  );

  const tips = useMemo(() => getTaxTips(province), [province]);
  const provinceName =
    PROVINCES.find((p) => p.code === province)?.name ?? province;
  const rrspMax = rrspLimit(effectiveGross);

  function setDeduction(key: keyof DeductionInputs, v: number) {
    setDeductions((d) => ({ ...d, [key]: v }));
  }

  const hasDeductions = Object.values(deductions).some((v) => v > 0);

  // RRSP tax-saving estimate
  const rrspSavingPerDollar = result.marginalCombined;

  if (annualGross === 0) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center gap-3 text-slate-500 py-12">
        <span className="text-4xl">🧾</span>
        <p className="text-sm text-center">
          Add income sources in the{" "}
          <strong className="text-slate-400">Flows</strong> tab to see your tax
          estimate.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header card ── */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              🧾 Income Tax Estimate
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {provinceName} · {TAX_DISCLAIMER}
            </p>
          </div>
        </div>

        {/* Gross income — shows flows-derived and allows override */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Annual Gross Income</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                $
              </span>
              <input
                className={`${inputCls} pl-6 pr-16`}
                value={
                  grossOverride ||
                  (annualGross > 0 ? Math.round(annualGross).toString() : "")
                }
                onChange={(e) =>
                  setGrossOverride(e.target.value.replace(/[^0-9.]/g, ""))
                }
                inputMode="decimal"
                placeholder={Math.round(annualGross).toString()}
              />
              {grossOverride && (
                <button
                  onClick={() => setGrossOverride("")}
                  title="Reset to income from flows"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
                >
                  Reset
                </button>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {grossOverride
                ? `Flows: ${Math.round(annualGrossFlows).toLocaleString()} · Reset to restore`
                : annualGross > 0
                  ? "From your income flows · edit to override"
                  : ""}
            </p>
          </div>
          <div>
            <label className={labelCls}>Monthly Gross</label>
            <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <span className="text-sm font-semibold text-slate-200 tabular-nums">
                {fmt(effectiveGross / 12)}
              </span>
              <span className="text-xs text-slate-500">/mo</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Deductions panel ── */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <button
          onClick={() => setShowDeductions((s) => !s)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-800/40 transition"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-100">
              💰 Tax Deductions
            </span>
            {hasDeductions && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 font-semibold">
                −{fmt(result.rrspDeduction + result.otherDeductions)} saved
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500">
            {showDeductions ? "▲ hide" : "▼ enter deductions"}
          </span>
        </button>

        {showDeductions && (
          <div className="px-5 pb-5 flex flex-col gap-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 mt-3">
              Deductions reduce your taxable income. Enter annual amounts.
            </p>

            <div className="p-3 rounded-xl bg-indigo-900/20 border border-indigo-800/40">
              <p className="text-xs text-indigo-300 font-semibold mb-0.5">
                RRSP tip
              </p>
              <p className="text-xs text-slate-400">
                At your income, each $1,000 in RRSP saves ~
                <strong className="text-emerald-400">
                  {fmt(rrspSavingPerDollar * 1000)}
                </strong>{" "}
                in taxes (marginal rate {pct(rrspSavingPerDollar)}). Maximum
                contribution room:{" "}
                <strong className="text-slate-200">{fmt(rrspMax)}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DeductionRow
                label="RRSP Contribution"
                hint="18% of prior year income, up to $31,560"
                value={deductions.rrsp}
                onChange={(v) => setDeduction("rrsp", v)}
                max={rrspMax}
              />
              <DeductionRow
                label="Union / Professional Dues"
                hint="T4 Box 44 — required for employment"
                value={deductions.unionDues}
                onChange={(v) => setDeduction("unionDues", v)}
              />
              <DeductionRow
                label="Childcare Expenses"
                hint="Up to $8,000/child < 7, $5,000 for 7–16"
                value={deductions.childcare}
                onChange={(v) => setDeduction("childcare", v)}
              />
              <DeductionRow
                label="Home Office (WFH days × $2)"
                hint="e.g. 200 days WFH = $400"
                value={deductions.homeOffice}
                onChange={(v) => setDeduction("homeOffice", v)}
                max={500}
              />
              <DeductionRow
                label="Moving Expenses"
                hint="40+ km closer to new work/school"
                value={deductions.movingExpenses}
                onChange={(v) => setDeduction("movingExpenses", v)}
              />
              <DeductionRow
                label="Student Loan Interest"
                hint="15% non-refundable federal credit applied"
                value={deductions.studentLoanInterest}
                onChange={(v) => setDeduction("studentLoanInterest", v)}
              />
              <div className="sm:col-span-2">
                <DeductionRow
                  label="Other Deductions"
                  hint="Any other eligible deductions (see tips below)"
                  value={deductions.other}
                  onChange={(v) => setDeduction("other", v)}
                />
              </div>
            </div>

            {hasDeductions && (
              <button
                onClick={() => setDeductions(ZERO_DEDUCTIONS)}
                className="self-start text-xs text-slate-500 hover:text-rose-400 transition"
              >
                Clear all deductions
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Tax breakdown card ── */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
        <h3 className="text-sm font-bold text-slate-100">
          📊 Annual Tax Breakdown
        </h3>

        {hasDeductions && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Taxable income</span>
            <span className="text-slate-200 tabular-nums font-semibold">
              {fmt(result.taxableIncome)}
            </span>
          </div>
        )}

        {/* Visual bars */}
        <div className="flex flex-col gap-2.5">
          <TaxBar
            label="Federal Tax"
            amount={result.federalTax}
            total={result.grossAnnual}
            color="bg-indigo-500"
          />
          <TaxBar
            label={`${province} Prov. Tax`}
            amount={result.provincialTax}
            total={result.grossAnnual}
            color="bg-violet-500"
          />
          <TaxBar
            label="CPP"
            amount={result.cpp}
            total={result.grossAnnual}
            color="bg-amber-500"
          />
          <TaxBar
            label="EI"
            amount={result.ei}
            total={result.grossAnnual}
            color="bg-orange-500"
          />
        </div>

        <div className="border-t border-slate-800 pt-3 flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Federal income tax</span>
            <span className="text-slate-200 tabular-nums">
              {fmt(result.federalTax)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Provincial income tax</span>
            <span className="text-slate-200 tabular-nums">
              {fmt(result.provincialTax)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">CPP contributions</span>
            <span className="text-slate-200 tabular-nums">
              {fmt(result.cpp)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">
              EI premiums{province === "QC" ? " (reduced — QPIP applies)" : ""}
            </span>
            <span className="text-slate-200 tabular-nums">
              {fmt(result.ei)}
            </span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-slate-700 pt-2 mt-1">
            <span className="text-slate-300">Total withheld</span>
            <span className="text-rose-300 tabular-nums">
              {fmt(result.totalWithholding)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Take-home summary ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-emerald-900/25 border border-emerald-800/50">
          <p className="text-xs text-emerald-400 uppercase tracking-widest mb-1">
            Annual Take-Home
          </p>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">
            {fmt(result.netAnnual)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">after all deductions</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-900/25 border border-emerald-800/50">
          <p className="text-xs text-emerald-400 uppercase tracking-widest mb-1">
            Monthly Take-Home
          </p>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">
            {fmt(result.netMonthly)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">after all deductions</p>
        </div>
      </div>

      {/* ── Rates ── */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
        <h3 className="text-sm font-bold text-slate-100">📐 Tax Rates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Effective rate</p>
            <p className="text-xl font-bold text-amber-400 tabular-nums">
              {pct(result.effectiveRate)}
            </p>
            <p className="text-xs text-slate-600">all withholding / gross</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Marginal federal</p>
            <p className="text-xl font-bold text-indigo-300 tabular-nums">
              {pct(result.marginalFederal)}
            </p>
            <p className="text-xs text-slate-600">on next dollar earned</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Combined marginal</p>
            <p className="text-xl font-bold text-violet-300 tabular-nums">
              {pct(result.marginalCombined)}
            </p>
            <p className="text-xs text-slate-600">fed + prov on next dollar</p>
          </div>
        </div>

        {/* RRSP quick-win */}
        {rrspMax > 0 && (
          <div className="mt-1 p-3 rounded-xl bg-indigo-900/20 border border-indigo-800/40">
            <p className="text-xs text-indigo-300 font-semibold">
              💡 Max RRSP saves you{" "}
              {fmt(
                Math.min(rrspMax - deductions.rrsp, rrspMax) *
                  result.marginalCombined,
              )}{" "}
              more in taxes
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Unused RRSP room: {fmt(Math.max(0, rrspMax - deductions.rrsp))} ·
              marginal rate {pct(result.marginalCombined)}
            </p>
          </div>
        )}
      </div>

      {/* ── Province tips ── */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <button
          onClick={() => setShowTips((s) => !s)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-800/40 transition"
        >
          <span className="text-sm font-bold text-slate-100">
            🍁 {provinceName} Tax Tips & Credits
          </span>
          <span className="text-xs text-slate-500">
            {showTips ? "▲ hide" : "▼ show all"}
          </span>
        </button>

        {showTips && (
          <div className="px-5 pb-5 border-t border-slate-800">
            <div className="flex flex-col gap-3 mt-4">
              {tips.map((tip) => (
                <div
                  key={tip.title}
                  className="flex gap-3"
                >
                  <span className="mt-0.5 shrink-0 text-base">
                    {tip.federal ? "🇨🇦" : "🍁"}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      {tip.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      {tip.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-4">
              🇨🇦 = federal credit/deduction · 🍁 = provincial
            </p>
          </div>
        )}
      </div>

      {/* ── CPP/EI info ── */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          CPP & EI Details
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
          <div>
            <p className="text-xs text-slate-500">CPP1 (employee)</p>
            <p className="text-sm font-semibold text-slate-200 tabular-nums">
              {fmt(Math.min(result.cpp, (68_500 - 3_500) * 0.0595))}
            </p>
            <p className="text-xs text-slate-600">5.95% · max $68.5k</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">CPP2 (employee)</p>
            <p className="text-sm font-semibold text-slate-200 tabular-nums">
              {fmt(Math.max(0, result.cpp - (68_500 - 3_500) * 0.0595))}
            </p>
            <p className="text-xs text-slate-600">4% · $68.5k–$73.2k</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">EI premium</p>
            <p className="text-sm font-semibold text-slate-200 tabular-nums">
              {fmt(result.ei)}
            </p>
            <p className="text-xs text-slate-600">
              {province === "QC" ? "1.27%" : "1.66%"} · max $63.2k insurable
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Employer CPP match</p>
            <p className="text-sm font-semibold text-slate-200 tabular-nums">
              {fmt(result.cpp)}
            </p>
            <p className="text-xs text-slate-600">employer matches your CPP</p>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">{TAX_DISCLAIMER}</p>
    </div>
  );
}

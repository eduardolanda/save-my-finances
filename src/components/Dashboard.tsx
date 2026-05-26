import { useMemo } from "react";
import { formatMoney } from "../currency";
import { calcPayment, calcCMHC as calcCMHCExport } from "./mortgage/math";
import type { FxRates } from "../currency";
import type { SavingEntry } from "../db";

const MTG_PREFIX = "smf_mtg_";
function mtgVal(key: string): string {
  try {
    return JSON.parse(localStorage.getItem(MTG_PREFIX + key) ?? "null") ?? "";
  } catch {
    return "";
  }
}
function parseN(s: string) {
  return parseFloat(String(s).replace(/,/g, "")) || 0;
}

const CATEGORY_ICON: Record<string, string> = {
  cash: "💵",
  bank: "🏦",
  stocks: "📈",
  rrsp: "🇨🇦",
};
const CATS = ["cash", "bank", "stocks", "rrsp"] as const;

interface Props {
  savings: SavingEntry[];
  primaryCurrency: string;
  rates: FxRates | null;
  totalSavings: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  navigate: (tab: string) => void;
}

function fmt(n: number, currency: string) {
  return formatMoney(n, currency);
}
function fmtSmall(n: number, currency: string) {
  return formatMoney(n, currency);
}

export default function Dashboard({
  savings,
  primaryCurrency,
  rates,
  totalSavings,
  monthlyIncome,
  monthlyExpenses,
  navigate,
}: Props) {
  const monthlyNet = monthlyIncome - monthlyExpenses;
  const hasFlows = monthlyIncome > 0 || monthlyExpenses > 0;

  // Read mortgage state from localStorage
  const mtg = useMemo(() => {
    const priceRaw = mtgVal("price");
    const dpRaw = mtgVal("dp");
    const dpMode = mtgVal("dpMode") || "$";
    const rateRaw = mtgVal("rate");
    const amort = parseInt(mtgVal("amort")) || 25;
    const payFreq = (mtgVal("payFreq") || "monthly") as
      | "monthly"
      | "semi-monthly"
      | "bi-weekly"
      | "weekly";
    const strataRaw = mtgVal("strata");
    const roommateRaw = mtgVal("roommate");

    const price = parseN(priceRaw);
    const annRate = parseFloat(rateRaw) / 100 || 0;
    const dpAbs = parseN(dpRaw);
    const dp = dpMode === "%" ? price * (dpAbs / 100) : dpAbs;
    const cmhc = calcCMHCExport(price, dp);
    const loan = price - dp + cmhc;
    const pmt =
      loan > 0 && annRate > 0 ? calcPayment(loan, annRate, amort, payFreq) : 0;
    const ppy = {
      monthly: 12,
      "semi-monthly": 24,
      "bi-weekly": 26,
      weekly: 52,
    }[payFreq];
    const pmtMonthly = (pmt * ppy) / 12;
    const strata = parseN(strataRaw);
    const roommate = parseN(roommateRaw);

    return {
      price,
      annRate,
      dp,
      loan,
      amort,
      pmtMonthly,
      strata,
      roommate,
      rateRaw,
      payFreq,
    };
  }, []);

  const hasMortgage = mtg.price > 0;

  const catTotals = useMemo(() => {
    const out: Partial<Record<string, number>> = {};
    for (const cat of CATS) {
      const total = savings
        .filter((s) => s.category === cat)
        .reduce((sum, s) => {
          if (!rates || s.currency === primaryCurrency) return sum + s.amount;
          const r =
            rates.rates[s.currency] && rates.rates[primaryCurrency]
              ? (s.amount / rates.rates[s.currency]) *
                rates.rates[primaryCurrency]
              : s.amount;
          return sum + r;
        }, 0);
      if (total > 0) out[cat] = total;
    }
    return out;
  }, [savings, rates, primaryCurrency]);

  const hasSavings = totalSavings > 0;

  // Colour helpers
  const netColor = monthlyNet >= 0 ? "text-emerald-300" : "text-rose-300";

  return (
    <div className="flex flex-col gap-6">
      {/* ── 3-column preview grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Savings card */}
        <button
          onClick={() => navigate("savings")}
          className="group text-left p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-700 hover:bg-slate-800/70 transition flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-100">
              🏦 Savings
            </span>
            <span className="text-xs text-indigo-400 group-hover:text-indigo-300 transition">
              View →
            </span>
          </div>
          {hasSavings ? (
            <>
              <p className="text-3xl font-bold text-slate-100 tabular-nums">
                {fmt(totalSavings, primaryCurrency)}
              </p>
              <div className="flex flex-col gap-1">
                {CATS.filter((c) => catTotals[c]).map((cat) => (
                  <p
                    key={cat}
                    className="text-xs text-slate-400"
                  >
                    <span className="mr-1">{CATEGORY_ICON[cat]}</span>
                    <span className="font-semibold text-slate-200 tabular-nums">
                      {fmtSmall(catTotals[cat]!, primaryCurrency)}
                    </span>
                    <span className="ml-1 text-slate-600">{cat}</span>
                  </p>
                ))}
              </div>
              <p className="text-xs text-slate-600">
                {savings.length} {savings.length === 1 ? "account" : "accounts"}
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-2 py-4">
              <p className="text-slate-500 text-sm">No savings recorded yet</p>
              <p className="text-xs text-indigo-400">Add your first entry →</p>
            </div>
          )}
        </button>

        {/* Income & Expenses card */}
        <button
          onClick={() => navigate("income")}
          className="group text-left p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-700 hover:bg-slate-800/70 transition flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-100">
              💸 Income & Expenses
            </span>
            <span className="text-xs text-indigo-400 group-hover:text-indigo-300 transition">
              View →
            </span>
          </div>
          {hasFlows ? (
            <>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Monthly income</span>
                  <span className="text-sm font-semibold text-emerald-300 tabular-nums">
                    {fmt(monthlyIncome, primaryCurrency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Monthly expenses
                  </span>
                  <span className="text-sm font-semibold text-rose-300 tabular-nums">
                    −{fmt(monthlyExpenses, primaryCurrency)}
                  </span>
                </div>
                <div className="border-t border-slate-700 pt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-semibold">
                    Monthly net
                  </span>
                  <span
                    className={`text-base font-bold tabular-nums ${netColor}`}
                  >
                    {fmt(monthlyNet, primaryCurrency)}
                  </span>
                </div>
              </div>
              {monthlyIncome > 0 && (
                <p className="text-xs text-slate-600">
                  Savings rate{" "}
                  {((Math.max(0, monthlyNet) / monthlyIncome) * 100).toFixed(0)}
                  %
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2 py-4">
              <p className="text-slate-500 text-sm">No flows recorded yet</p>
              <p className="text-xs text-indigo-400">Add income & expenses →</p>
            </div>
          )}
        </button>

        {/* Mortgage card */}
        <button
          onClick={() => navigate("mortgage")}
          className="group text-left p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-700 hover:bg-slate-800/70 transition flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-slate-100">
              🏠 Mortgage
            </span>
            <span className="text-xs text-indigo-400 group-hover:text-indigo-300 transition">
              View →
            </span>
          </div>
          {hasMortgage ? (
            <>
              <p className="text-3xl font-bold text-white tabular-nums">
                {fmt(mtg.price, primaryCurrency)}
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Rate</span>
                  <span className="text-sm font-semibold text-slate-200">
                    {(mtg.annRate * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Amortization</span>
                  <span className="text-sm font-semibold text-slate-200">
                    {mtg.amort} yrs
                  </span>
                </div>
                {mtg.pmtMonthly > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Monthly payment
                    </span>
                    <span className="text-sm font-semibold text-indigo-300 tabular-nums">
                      {fmt(mtg.pmtMonthly, primaryCurrency)}
                    </span>
                  </div>
                )}
                {mtg.strata > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Strata</span>
                    <span className="text-sm font-semibold text-slate-400 tabular-nums">
                      +{fmt(mtg.strata, primaryCurrency)}
                    </span>
                  </div>
                )}
                {mtg.roommate > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Roommate</span>
                    <span className="text-sm font-semibold text-emerald-400 tabular-nums">
                      −{fmt(mtg.roommate, primaryCurrency)}
                    </span>
                  </div>
                )}
              </div>
              {mtg.pmtMonthly > 0 && mtg.strata > 0 && (
                <p className="text-xs text-slate-600">
                  Net housing cost{" "}
                  {fmt(
                    Math.max(0, mtg.pmtMonthly + mtg.strata - mtg.roommate),
                    primaryCurrency,
                  )}
                  /mo
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2 py-4">
              <p className="text-slate-500 text-sm">No mortgage configured</p>
              <p className="text-xs text-indigo-400">
                Calculate your mortgage →
              </p>
            </div>
          )}
        </button>
      </div>

      {/* ── Quick links ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "+ Add Saving",
            action: () => navigate("savings"),
            icon: "💰",
          },
          {
            label: "Plan Mortgage",
            action: () => navigate("mortgage"),
            icon: "🏠",
          },
          {
            label: "Track Income",
            action: () => navigate("income"),
            icon: "📥",
          },
          {
            label: "View Projections",
            action: () => navigate("income"),
            icon: "📈",
          },
        ].map(({ label, action, icon }) => (
          <button
            key={label}
            onClick={action}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 hover:text-white font-medium transition border border-slate-700 hover:border-slate-600"
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

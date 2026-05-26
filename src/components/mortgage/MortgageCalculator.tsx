import { useMemo } from "react";
import {
  MORTGAGE_TYPES,
  calcCMHC,
  calcGST,
  calcPayment,
  buildSchedule,
  minDP,
  periodsPerYear,
  fmt,
  fmtCommas,
  parseN,
} from "./math";
import {
  PROVINCES,
  calcLTT,
  hasForeignBuyerTax,
  ftbNote,
  type ProvinceCode,
} from "./provinces";
import { usePersistedState } from "./usePersistedState";
import { inputCls, labelCls, Check } from "./ui";
import ResultsTab from "./tabs/ResultsTab";
import CostsTab from "./tabs/CostsTab";
import ScheduleTab from "./tabs/ScheduleTab";
import ChartsTab from "./tabs/ChartsTab";
import type { PayFreq, LumpFreq } from "./types";

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { id: "results", label: "📊 Results" },
  { id: "costs", label: "🍁 Costs" },
  { id: "schedule", label: "📅 Schedule" },
  { id: "charts", label: "📈 Charts" },
] as const;

type Section = (typeof TABS)[number]["id"];

// ── Utility fields config (avoids repetition in the JSX) ─────────────────────
type UtilField = [label: string, value: string, set: (v: string) => void];

// ── Component ─────────────────────────────────────────────────────────────────
export default function MortgageCalculator({
  monthlyIncome = 0,
  monthlyExpenses = 0,
  province,
}: {
  monthlyIncome?: number;
  monthlyExpenses?: number;
  province: ProvinceCode;
}) {
  // ── Persisted inputs ──────────────────────────────────────────────────────
  const [priceRaw, setPriceRaw] = usePersistedState("price", "800,000");
  const [dpRaw, setDpRaw] = usePersistedState("dp", "160,000");
  const [dpMode, setDpMode] = usePersistedState<"$" | "%">("dpMode", "$");
  const [rateRaw, setRateRaw] = usePersistedState("rate", "4.5");
  const [amort, setAmort] = usePersistedState("amort", 25);
  const [extraRaw, setExtraRaw] = usePersistedState("extra", "");
  const [payFreq, setPayFreq] = usePersistedState<PayFreq>(
    "payFreq",
    "monthly",
  );
  const [mortgageType, setMortgageType] = usePersistedState(
    "mortgageType",
    "custom",
  );
  const [extraFreq, setExtraFreq] = usePersistedState<LumpFreq>(
    "extraFreq",
    "annually",
  );
  const [payIncrRaw, setPayIncrRaw] = usePersistedState("payIncr", "");
  const [payIncrFreq, setPayIncrFreq] = usePersistedState<LumpFreq>(
    "payIncrFreq",
    "once",
  );
  const [strataRaw, setStrataRaw] = usePersistedState("strata", "");
  const [roommateRaw, setRoommateRaw] = usePersistedState("roommate", "");

  // Utilities
  const [elecRaw, setElecRaw] = usePersistedState("util_elec", "");
  const [gasRaw, setGasRaw] = usePersistedState("util_gas", "");
  const [waterRaw, setWaterRaw] = usePersistedState("util_water", "");
  const [internetRaw, setInternetRaw] = usePersistedState("util_internet", "");
  const [phoneRaw, setPhoneRaw] = usePersistedState("util_phone", "");
  const [insuranceRaw, setInsuranceRaw] = usePersistedState(
    "util_insurance",
    "",
  );
  const [garbageRaw, setGarbageRaw] = usePersistedState("util_garbage", "");

  // Property flags
  const [firstTimeBuyer, setFTB] = usePersistedState("ftb", false);
  const [newConstruction, setNewConstr] = usePersistedState("newConstr", false);
  const [investmentProp, setInvestment] = usePersistedState(
    "investment",
    false,
  );
  const [foreignBuyer, setForeign] = usePersistedState("foreign", false);

  // UI
  const [activeSection, setActiveSection] = usePersistedState<Section>(
    "section",
    "results",
  );

  // ── Derived values ────────────────────────────────────────────────────────
  const price = parseN(priceRaw);
  const annRate = parseFloat(rateRaw) / 100 || 0;
  const extra = parseN(extraRaw);
  const payIncr = parseN(payIncrRaw);
  const strata = parseN(strataRaw);
  const roommate = parseN(roommateRaw);
  const ppy = periodsPerYear(payFreq);

  const totalUtilities =
    parseN(elecRaw) +
    parseN(gasRaw) +
    parseN(waterRaw) +
    parseN(internetRaw) +
    parseN(phoneRaw) +
    parseN(insuranceRaw) +
    parseN(garbageRaw);

  const downPayment = useMemo(() => {
    const raw = parseN(dpRaw);
    return dpMode === "%" ? price * (raw / 100) : raw;
  }, [dpRaw, dpMode, price]);

  const dpPct = price > 0 ? (downPayment / price) * 100 : 0;
  const dpMin = minDP(price);
  const dpError = price > 0 && downPayment < dpMin;

  const cmhc = calcCMHC(price, downPayment);
  const loan = price - downPayment + cmhc;
  const pmt = loan > 0 ? calcPayment(loan, annRate, amort, payFreq) : 0;
  const pmtMonthlyEquiv = (pmt * ppy) / 12;

  const grossMonthlyHousing = pmtMonthlyEquiv + strata;
  const totalMonthlyHousing = Math.max(0, grossMonthlyHousing - roommate);
  const totalMonthlyCost = totalMonthlyHousing + totalUtilities;
  const totalMonthlyCommitted = totalMonthlyCost + monthlyExpenses;
  const monthlyLeft =
    monthlyIncome > 0 ? monthlyIncome - totalMonthlyCommitted : null;
  const housingRatio =
    monthlyIncome > 0 ? (totalMonthlyCommitted / monthlyIncome) * 100 : null;

  const baseSchedule = useMemo(
    () =>
      loan > 0
        ? buildSchedule(loan, annRate, amort, payFreq, 0, "annually", 0, "once")
        : null,
    [loan, annRate, amort, payFreq],
  );
  const extraSchedule = useMemo(
    () =>
      loan > 0 && (extra > 0 || payIncr > 0)
        ? buildSchedule(
            loan,
            annRate,
            amort,
            payFreq,
            extra,
            extraFreq,
            payIncr,
            payIncrFreq,
          )
        : null,
    [loan, annRate, amort, payFreq, extra, extraFreq, payIncr, payIncrFreq],
  );

  const totalInterest = baseSchedule?.totalInterest ?? 0;
  const hasExtra = extra > 0 || payIncr > 0;
  const interestSaved =
    hasExtra && baseSchedule && extraSchedule
      ? baseSchedule.totalInterest - extraSchedule.totalInterest
      : 0;
  const periodsSaved =
    hasExtra && baseSchedule && extraSchedule
      ? baseSchedule.payoffPeriod - extraSchedule.payoffPeriod
      : 0;
  const monthsSaved = Math.round((periodsSaved / ppy) * 12);

  const lttResult = calcLTT(
    province,
    price,
    firstTimeBuyer,
    newConstruction,
    foreignBuyer,
  );
  const gstInfo = newConstruction ? calcGST(price, investmentProp) : null;
  const totalClosing =
    lttResult.tax +
    lttResult.foreignTax +
    (gstInfo?.net ?? 0) +
    1_500 +
    500 +
    300;
  const cashToClose = downPayment + totalClosing;

  const stressRate = Math.max(annRate + 0.02, 0.0525);
  const stressPmt =
    loan > 0 ? calcPayment(loan, stressRate, amort, payFreq) : 0;

  const balanceChartData = useMemo(() => {
    if (!baseSchedule) return [];
    return baseSchedule.yearRows.map((yr, i) => ({
      year: `Yr ${yr.year}`,
      Standard: Math.round(yr.balance),
      ...(extraSchedule?.yearRows[i]
        ? { "With Extra": Math.round(extraSchedule.yearRows[i].balance) }
        : {}),
    }));
  }, [baseSchedule, extraSchedule]);

  const piChartData = useMemo(() => {
    if (!baseSchedule) return [];
    return baseSchedule.yearRows.map((yr) => ({
      year: `Yr ${yr.year}`,
      Interest: Math.round(yr.interest),
      Principal: Math.round(yr.principal),
    }));
  }, [baseSchedule]);

  const showResults = !dpError && price > 0 && loan > 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  function numericHandler(set: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      set(
        fmtCommas(
          e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"),
        ),
      );
  }

  function toggleDpMode() {
    if (dpMode === "$") {
      setDpMode("%");
      setDpRaw(price > 0 ? ((downPayment / price) * 100).toFixed(2) : "20");
    } else {
      setDpMode("$");
      setDpRaw(fmtCommas(Math.round(downPayment).toString()));
    }
  }

  // ── Utility fields ────────────────────────────────────────────────────────
  const utilityFields: UtilField[] = [
    ["Electricity", elecRaw, setElecRaw],
    ["Natural Gas", gasRaw, setGasRaw],
    ["Water / Sewer", waterRaw, setWaterRaw],
    ["Internet", internetRaw, setInternetRaw],
    ["Phone", phoneRaw, setPhoneRaw],
    ["Home Insurance", insuranceRaw, setInsuranceRaw],
    ["Garbage / Recycling", garbageRaw, setGarbageRaw],
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">
      {/* ════════════════════════════════ Inputs ════════════════════════════ */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
        <h2 className="text-base font-bold text-slate-100 mb-4">
          🏠 Mortgage Calculator
          <span className="ml-2 text-xs font-normal text-slate-500">
            {PROVINCES.find((p) => p.code === province)?.name ?? province},
            Canada
          </span>
        </h2>

        {/* Province selector */}
        <div className="mb-4">
          <label className={labelCls}>Province / Territory</label>
          <div className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm text-slate-300">
            {PROVINCES.find((p) => p.code === province)?.name ?? province}
            <span className="ml-2 text-xs text-slate-500">
              — change in the header selector
            </span>
          </div>
        </div>

        {/* Core fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Property price */}
          <div>
            <label className={labelCls}>Property Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                $
              </span>
              <input
                className={`${inputCls} pl-6`}
                value={priceRaw}
                onChange={numericHandler(setPriceRaw)}
                inputMode="decimal"
                placeholder="800,000"
              />
            </div>
          </div>

          {/* Down payment */}
          <div>
            <label className={labelCls}>
              Down Payment
              {price > 0 && (
                <span className="ml-2 text-slate-500">
                  ({dpPct.toFixed(1)}% · min {fmt(dpMin)})
                </span>
              )}
            </label>
            <div className="flex gap-1">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                  {dpMode}
                </span>
                <input
                  className={`${inputCls} pl-6 ${dpError ? "border-red-500" : ""}`}
                  value={dpRaw}
                  onChange={numericHandler(setDpRaw)}
                  inputMode="decimal"
                  placeholder={dpMode === "$" ? "160,000" : "20"}
                />
              </div>
              <button
                onClick={toggleDpMode}
                className="w-10 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold transition"
              >
                {dpMode === "$" ? "%" : "$"}
              </button>
            </div>
            {dpError && (
              <p className="text-xs text-red-400 mt-1">
                Minimum down payment is {fmt(dpMin)}
              </p>
            )}
          </div>

          {/* Mortgage type */}
          <div>
            <label className={labelCls}>Type of Mortgage</label>
            <select
              className={inputCls}
              value={mortgageType}
              onChange={(e) => {
                const t = MORTGAGE_TYPES.find((m) => m.id === e.target.value);
                setMortgageType(e.target.value);
                if (t?.rate != null) setRateRaw(String(t.rate));
              }}
            >
              {MORTGAGE_TYPES.map((t) => (
                <option
                  key={t.id}
                  value={t.id}
                >
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Interest rate */}
          <div>
            <label className={labelCls}>Interest Rate (annual)</label>
            <div className="relative">
              <input
                className={`${inputCls} pr-7`}
                value={rateRaw}
                onChange={(e) => {
                  setRateRaw(e.target.value.replace(/[^0-9.]/g, ""));
                  setMortgageType("custom");
                }}
                inputMode="decimal"
                placeholder="4.5"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                %
              </span>
            </div>
          </div>

          {/* Amortization */}
          <div>
            <label className={labelCls}>Amortization Period</label>
            <select
              className={inputCls}
              value={amort}
              onChange={(e) => setAmort(Number(e.target.value))}
            >
              {[5, 10, 15, 20, 25, 30].map((y) => (
                <option
                  key={y}
                  value={y}
                >
                  {y} years
                </option>
              ))}
            </select>
          </div>

          {/* Payment frequency */}
          <div>
            <label className={labelCls}>Payment Frequency</label>
            <select
              className={inputCls}
              value={payFreq}
              onChange={(e) => setPayFreq(e.target.value as PayFreq)}
            >
              <option value="monthly">Monthly</option>
              <option value="semi-monthly">Semi-Monthly</option>
              <option value="bi-weekly">Bi-Weekly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>

        {/* ── Strata & Roommate ── */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-400 mb-3">
            Property Costs &amp; Offsets
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                Strata / Condo Fee{" "}
                <span className="text-slate-600">(monthly)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                  $
                </span>
                <input
                  className={`${inputCls} pl-6`}
                  value={strataRaw}
                  onChange={numericHandler(setStrataRaw)}
                  inputMode="decimal"
                  placeholder="0"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>
                Roommate{" "}
                <span className="text-slate-600">(monthly, optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                  $
                </span>
                <input
                  className={`${inputCls} pl-6`}
                  value={roommateRaw}
                  onChange={numericHandler(setRoommateRaw)}
                  inputMode="decimal"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Utilities ── */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-400 mb-3">
            Monthly Utilities{" "}
            <span className="text-slate-600">
              (optional — included in affordability)
            </span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {utilityFields.map(([lbl, val, set]) => (
              <div key={lbl}>
                <label className={labelCls}>{lbl}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                    $
                  </span>
                  <input
                    className={`${inputCls} pl-6`}
                    value={val}
                    onChange={numericHandler(set)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Extra payments ── */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col gap-4">
          {/* Lump sum */}
          <div>
            <p className="text-xs text-slate-400 mb-2">
              Add lump sum payments and pay off your mortgage faster
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                    $
                  </span>
                  <input
                    className={`${inputCls} pl-6`}
                    value={extraRaw}
                    onChange={numericHandler(setExtraRaw)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Frequency</label>
                <select
                  className={inputCls}
                  value={extraFreq}
                  onChange={(e) => setExtraFreq(e.target.value as LumpFreq)}
                >
                  <option value="once">Once</option>
                  <option value="annually">Annually</option>
                  <option value="semi-annually">Semi-Annually</option>
                </select>
              </div>
            </div>
          </div>

          {/* Payment increase */}
          <div>
            <p className="text-xs text-slate-400 mb-2">
              Increase your payments to reduce your mortgage length
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Increase payment by</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                    $
                  </span>
                  <input
                    className={`${inputCls} pl-6`}
                    value={payIncrRaw}
                    onChange={numericHandler(setPayIncrRaw)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Frequency</label>
                <select
                  className={inputCls}
                  value={payIncrFreq}
                  onChange={(e) => setPayIncrFreq(e.target.value as LumpFreq)}
                >
                  <option value="once">Once</option>
                  <option value="annually">Annually</option>
                  <option value="semi-annually">Semi-Annually</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── Property flags ── */}
        <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Check
            checked={firstTimeBuyer}
            onChange={(v) => {
              setFTB(v);
              if (v) setInvestment(false);
            }}
          >
            First-time home buyer
            <span className="block text-xs text-slate-500">
              Must be Canadian citizen/PR · {ftbNote(province)}
            </span>
          </Check>
          <Check
            checked={newConstruction}
            onChange={setNewConstr}
          >
            New construction / newly built
            <span className="block text-xs text-slate-500">
              5% GST applies
              {province === "BC"
                ? " · PTT exempt ≤$1.1M (principal residence)"
                : ""}
            </span>
          </Check>
          <Check
            checked={investmentProp}
            onChange={(v) => {
              setInvestment(v);
              if (v) setFTB(false);
            }}
          >
            Investment / rental property
            <span className="block text-xs text-slate-500">
              No GST rebate · no land transfer tax exemptions
            </span>
          </Check>
          {hasForeignBuyerTax(province) && (
            <Check
              checked={foreignBuyer}
              onChange={setForeign}
            >
              Foreign buyer
              <span className="block text-xs text-slate-500">
                +20% Additional Property Transfer Tax (BC)
              </span>
            </Check>
          )}
        </div>
      </div>

      {/* ════════════════════════════ Tab sections ══════════════════════════ */}
      {showResults && (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveSection(t.id)}
                className={`shrink-0 flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeSection === t.id
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeSection === "results" && (
            <ResultsTab
              payFreq={payFreq}
              pmt={pmt}
              pmtMonthlyEquiv={pmtMonthlyEquiv}
              amort={amort}
              downPayment={downPayment}
              strata={strata}
              roommate={roommate}
              grossMonthlyHousing={grossMonthlyHousing}
              totalMonthlyHousing={totalMonthlyHousing}
              totalUtilities={totalUtilities}
              totalMonthlyCost={totalMonthlyCost}
              loan={loan}
              cmhc={cmhc}
              totalInterest={totalInterest}
              stressRate={stressRate}
              stressPmt={stressPmt}
              monthlyLeft={monthlyLeft}
              housingRatio={housingRatio}
              totalMonthlyCommitted={totalMonthlyCommitted}
              monthlyExpenses={monthlyExpenses}
              hasExtra={hasExtra}
              extra={extra}
              payIncr={payIncr}
              extraSchedule={extraSchedule}
              interestSaved={interestSaved}
              monthsSaved={monthsSaved}
              ppy={ppy}
            />
          )}

          {activeSection === "costs" && (
            <CostsTab
              province={province}
              lttResult={lttResult}
              gstInfo={gstInfo}
              totalClosing={totalClosing}
              downPayment={downPayment}
              cashToClose={cashToClose}
            />
          )}

          {activeSection === "schedule" && baseSchedule && (
            <ScheduleTab
              baseSchedule={baseSchedule}
              extraSchedule={extraSchedule}
              hasExtra={hasExtra}
              loan={loan}
            />
          )}

          {activeSection === "charts" && baseSchedule && (
            <ChartsTab
              balanceChartData={balanceChartData}
              piChartData={piChartData}
              hasExtra={hasExtra}
            />
          )}
        </>
      )}
    </div>
  );
}

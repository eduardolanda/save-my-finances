import { useState, useMemo } from "react";
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
  ReferenceLine,
} from "recharts";
import { useFlows, addFlow, updateFlow, deleteFlow } from "../hooks";
import { convert, formatMoney, type FxRates } from "../currency";
import { type FlowEntry, type FlowFrequency } from "../db";
import CurrencySelector from "./CurrencySelector";

// ── helpers ───────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

const FREQ_LABELS: Record<FlowFrequency, string> = {
  once: "One-time",
  weekly: "Weekly",
  "bi-weekly": "Bi-weekly",
  "semi-monthly": "Semi-monthly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  "semi-annually": "Semi-annually",
  annually: "Annually",
};

const FREQ_MONTHS: Record<FlowFrequency, number> = {
  once: 0,
  weekly: 1 / 4.333,
  "bi-weekly": 1 / 2.167,
  "semi-monthly": 0.5,
  monthly: 1,
  quarterly: 3,
  "semi-annually": 6,
  annually: 12,
};

const EXPENSE_CATS = [
  "Housing",
  "Transport",
  "Food",
  "Utilities",
  "Health",
  "Entertainment",
  "Subscriptions",
  "Other",
];

/** Returns the monthly-equivalent amount for a flow, converted to targetCurrency */
export function monthlyAmount(
  f: FlowEntry,
  target: string,
  rates: FxRates | null,
): number {
  const base = rates ? convert(f.amount, f.currency, target, rates) : f.amount;
  if (!f.recurrent || f.frequency === "once") return 0;
  return base / FREQ_MONTHS[f.frequency];
}

/** Returns the occurrence dates of a flow within [startMs, endMs] */
function occurrences(
  f: FlowEntry,
  startMs: number,
  endMs: number,
): { ms: number; amount: number }[] {
  const sign = f.kind === "income" ? 1 : -1;
  const result: { ms: number; amount: number }[] = [];
  const flowStart = new Date(f.startDate).getTime();
  const flowEnd = f.endDate ? new Date(f.endDate).getTime() : Infinity;

  if (!f.recurrent || f.frequency === "once") {
    if (flowStart >= startMs && flowStart <= endMs && flowStart <= flowEnd)
      result.push({ ms: flowStart, amount: sign * f.amount });
    return result;
  }

  const freqMs = FREQ_MONTHS[f.frequency] * 30.44 * 24 * 3600 * 1000;
  let cur = flowStart;
  while (cur <= endMs) {
    if (cur >= startMs && cur <= flowEnd)
      result.push({ ms: cur, amount: sign * f.amount });
    cur += freqMs;
  }
  return result;
}

/** Build month-by-month projection */
function buildProjection(
  flows: FlowEntry[],
  initialSavings: number,
  horizonMonths: number,
  target: string,
  rates: FxRates | null,
) {
  const now = new Date();
  const rows: {
    label: string;
    net: number;
    income: number;
    expenses: number;
    balance: number;
  }[] = [];
  let balance = initialSavings;

  for (let m = 0; m < horizonMonths; m++) {
    const date = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const mStart = date.getTime();
    const mEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getTime();

    let income = 0,
      expenses = 0;
    for (const f of flows) {
      const occ = occurrences(f, mStart, mEnd);
      const cv = rates ? convert(1, f.currency, target, rates) : 1;
      for (const o of occ) {
        if (f.kind === "income") income += Math.abs(o.amount) * cv;
        else expenses += Math.abs(o.amount) * cv;
      }
    }

    const net = income - expenses;
    balance += net;
    rows.push({
      label: date.toLocaleDateString("en-CA", {
        month: "short",
        year: "2-digit",
      }),
      net,
      income,
      expenses,
      balance: Math.round(balance),
    });
  }
  return rows;
}

// ── sub-components ────────────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 transition";
const labelCls = "block text-xs text-slate-400 mb-1";
const CAD2 = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});
const tooltipStyle = {
  backgroundColor: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 10,
  color: "#f1f5f9",
  fontSize: 12,
};
const axisStyle = { fontSize: 11, fill: "#64748b" };

function fmtAmt(n: number, currency: string) {
  try {
    return formatMoney(n, currency);
  } catch {
    return CAD2.format(n);
  }
}

interface FlowFormProps {
  kind: "income" | "expense";
  initial?: FlowEntry;
  primaryCurrency: string;
  onSave: (data: Omit<FlowEntry, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}

function FlowForm({
  kind,
  initial,
  primaryCurrency,
  onSave,
  onCancel,
}: FlowFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [currency, setCurrency] = useState(
    initial?.currency ?? primaryCurrency,
  );
  const [recurrent, setRecurrent] = useState(initial?.recurrent ?? true);
  const [frequency, setFrequency] = useState<FlowFrequency>(
    initial?.frequency ?? "monthly",
  );
  const [startDate, setStartDate] = useState(initial?.startDate ?? today());
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Other");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount.replace(/,/g, "")) || 0;
    if (!name.trim() || amt <= 0) return;
    onSave({
      kind,
      name: name.trim(),
      amount: amt,
      currency,
      recurrent,
      frequency: recurrent ? frequency : "once",
      startDate,
      endDate: endDate || undefined,
      category: kind === "expense" ? category : undefined,
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Name / description</label>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              kind === "income"
                ? "e.g. Salary, Freelance"
                : "e.g. Rent, Netflix"
            }
            required
          />
        </div>
        <div>
          <label className={labelCls}>Amount</label>
          <input
            className={inputCls}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className={labelCls}>Currency</label>
          <CurrencySelector
            current={currency}
            onChange={setCurrency}
          />
        </div>
        {kind === "expense" && (
          <div className="col-span-2">
            <label className={labelCls}>Category</label>
            <select
              className={inputCls}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {EXPENSE_CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
        <div className="col-span-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={recurrent}
              onChange={(e) => setRecurrent(e.target.checked)}
              className="accent-indigo-500 w-4 h-4"
            />
            <span className="text-sm text-slate-300">Recurring payment</span>
          </label>
        </div>
        {recurrent && (
          <div>
            <label className={labelCls}>Frequency</label>
            <select
              className={inputCls}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as FlowFrequency)}
            >
              {(Object.entries(FREQ_LABELS) as [FlowFrequency, string][])
                .filter(([k]) => k !== "once")
                .map(([k, v]) => (
                  <option
                    key={k}
                    value={k}
                  >
                    {v}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div>
          <label className={labelCls}>Start date</label>
          <input
            type="date"
            className={inputCls}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        {recurrent && (
          <div>
            <label className={labelCls}>
              End date <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="date"
              className={inputCls}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          className={`px-4 py-1.5 rounded-lg text-white text-sm font-semibold transition ${kind === "income" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-700 hover:bg-rose-600"}`}
        >
          {initial ? "Save" : "Add"}
        </button>
      </div>
    </form>
  );
}

// ── Flow row ──────────────────────────────────────────────────────────────────
function FlowRow({
  flow,
  primary,
  rates,
}: {
  flow: FlowEntry;
  primary: string;
  rates: FxRates | null;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const monthly = monthlyAmount(flow, primary, rates);

  async function handleSave(
    data: Omit<FlowEntry, "id" | "createdAt" | "updatedAt">,
  ) {
    await updateFlow(flow.id!, data);
    setEditing(false);
  }

  if (editing)
    return (
      <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700">
        <FlowForm
          kind={flow.kind}
          initial={flow}
          primaryCurrency={primary}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      </div>
    );

  const kindColor =
    flow.kind === "income" ? "text-emerald-400" : "text-rose-400";
  const freqLabel = flow.recurrent ? FREQ_LABELS[flow.frequency] : "One-time";

  return (
    <div
      onClick={() => setEditing(true)}
      className="group flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-600 cursor-pointer transition"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-100 truncate">
            {flow.name}
          </span>
          {flow.kind === "expense" && flow.category && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
              {flow.category}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-xs ${kindColor}`}>
            {fmtAmt(flow.amount, flow.currency)}
          </span>
          <span className="text-xs text-slate-600">·</span>
          <span className="text-xs text-slate-500">{freqLabel}</span>
          {flow.recurrent && monthly > 0 && (
            <>
              <span className="text-xs text-slate-600">·</span>
              <span className={`text-xs ${kindColor} font-medium`}>
                {fmtAmt(monthly, primary)}/mo
              </span>
            </>
          )}
        </div>
      </div>
      <div
        className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition"
        onClick={(e) => e.stopPropagation()}
      >
        {deleting ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => deleteFlow(flow.id!)}
              className="px-2 py-1 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold transition"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleting(false)}
              className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setDeleting(true)}
            className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-rose-800 text-slate-300 text-xs flex items-center justify-center transition"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const HORIZON_OPTIONS = [
  { label: "3 months", months: 3 },
  { label: "6 months", months: 6 },
  { label: "1 year", months: 12 },
  { label: "2 years", months: 24 },
  { label: "5 years", months: 60 },
  { label: "10 years", months: 120 },
];

interface Props {
  primaryCurrency: string;
  rates: FxRates | null;
  totalSavings: number;
}

export default function IncomeExpenses({
  primaryCurrency,
  rates,
  totalSavings,
}: Props) {
  const flows = useFlows();
  const incomes = flows.filter((f) => f.kind === "income");
  const expenses = flows.filter((f) => f.kind === "expense");

  const [activeSection, setActiveSection] = useState<"flows" | "projections">(
    "flows",
  );
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [horizonMonths, setHorizonMonths] = useState(12);
  const [customHorizon, setCustomHorizon] = useState("");
  const [includeDate, setIncludeDate] = useState("");

  const effectiveHorizon = useMemo(() => {
    if (includeDate) {
      const diffMs = new Date(includeDate).getTime() - Date.now();
      const m = Math.max(1, Math.ceil(diffMs / (30.44 * 24 * 3600 * 1000)));
      return m;
    }
    if (customHorizon)
      return Math.max(1, Math.min(360, parseInt(customHorizon) || 12));
    return horizonMonths;
  }, [horizonMonths, customHorizon, includeDate]);

  // Monthly totals
  const monthlyIncome = useMemo(
    () =>
      incomes.reduce((s, f) => s + monthlyAmount(f, primaryCurrency, rates), 0),
    [incomes, primaryCurrency, rates],
  );
  const monthlyExpenses = useMemo(
    () =>
      expenses.reduce(
        (s, f) => s + monthlyAmount(f, primaryCurrency, rates),
        0,
      ),
    [expenses, primaryCurrency, rates],
  );
  const monthlyNet = monthlyIncome - monthlyExpenses;

  const projection = useMemo(
    () =>
      buildProjection(
        flows,
        totalSavings,
        effectiveHorizon,
        primaryCurrency,
        rates,
      ),
    [flows, totalSavings, effectiveHorizon, primaryCurrency, rates],
  );

  const finalBalance =
    projection[projection.length - 1]?.balance ?? totalSavings;

  // Expense breakdown by category
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of expenses) {
      const key = f.category || "Other";
      map.set(
        key,
        (map.get(key) ?? 0) + monthlyAmount(f, primaryCurrency, rates),
      );
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expenses, primaryCurrency, rates]);

  const fmt = (n: number) => fmtAmt(Math.abs(n), primaryCurrency);

  async function handleAddFlow(
    data: Omit<FlowEntry, "id" | "createdAt" | "updatedAt">,
  ) {
    await addFlow(data);
    setShowAddIncome(false);
    setShowAddExpense(false);
  }

  const SECTIONS = [
    { id: "flows", label: "💸 Flows" },
    { id: "projections", label: "📈 Projections" },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-emerald-900/25 border border-emerald-800/50">
          <p className="text-xs text-emerald-400 uppercase tracking-widest mb-1">
            Monthly Income
          </p>
          <p className="text-xl font-bold text-emerald-400 tabular-nums">
            {fmt(monthlyIncome)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {incomes.length} source{incomes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-rose-900/25 border border-rose-800/50">
          <p className="text-xs text-rose-400 uppercase tracking-widest mb-1">
            Monthly Expenses
          </p>
          <p className="text-xl font-bold text-rose-400 tabular-nums">
            {fmt(monthlyExpenses)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {expenses.length} item{expenses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div
          className={`p-4 rounded-2xl border ${monthlyNet >= 0 ? "bg-indigo-900/25 border-indigo-800/50" : "bg-amber-900/25 border-amber-800/50"}`}
        >
          <p
            className={`text-xs uppercase tracking-widest mb-1 ${monthlyNet >= 0 ? "text-indigo-400" : "text-amber-400"}`}
          >
            Monthly Net
          </p>
          <p
            className={`text-xl font-bold tabular-nums ${monthlyNet >= 0 ? "text-indigo-300" : "text-amber-400"}`}
          >
            {monthlyNet >= 0 ? "+" : "−"}
            {fmt(monthlyNet)}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            savings rate{" "}
            {monthlyIncome > 0
              ? ((monthlyNet / monthlyIncome) * 100).toFixed(0)
              : 0}
            %
          </p>
        </div>
      </div>

      {/* ── Section tabs ── */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSection === s.id
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── FLOWS ── */}
      {activeSection === "flows" && (
        <div className="flex flex-col gap-6">
          {/* Incomes */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-200">💚 Income</h3>
              <button
                onClick={() => {
                  setShowAddIncome(true);
                  setShowAddExpense(false);
                }}
                className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold transition"
              >
                + Add income
              </button>
            </div>

            {showAddIncome && (
              <div className="mb-3 p-4 rounded-2xl bg-slate-900 border border-emerald-800/50">
                <FlowForm
                  kind="income"
                  primaryCurrency={primaryCurrency}
                  onSave={handleAddFlow}
                  onCancel={() => setShowAddIncome(false)}
                />
              </div>
            )}

            {incomes.length === 0 && !showAddIncome ? (
              <p className="text-sm text-slate-600 py-4 text-center">
                No income sources yet
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {incomes.map((f) => (
                  <FlowRow
                    key={f.id}
                    flow={f}
                    primary={primaryCurrency}
                    rates={rates}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Expenses */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-200">🔴 Expenses</h3>
              <button
                onClick={() => {
                  setShowAddExpense(true);
                  setShowAddIncome(false);
                }}
                className="px-3 py-1 rounded-lg bg-rose-800 hover:bg-rose-700 text-white text-xs font-semibold transition"
              >
                + Add expense
              </button>
            </div>

            {showAddExpense && (
              <div className="mb-3 p-4 rounded-2xl bg-slate-900 border border-rose-800/50">
                <FlowForm
                  kind="expense"
                  primaryCurrency={primaryCurrency}
                  onSave={handleAddFlow}
                  onCancel={() => setShowAddExpense(false)}
                />
              </div>
            )}

            {expenseByCategory.length > 0 && (
              <div className="mb-3 p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap gap-2">
                {expenseByCategory.map(([cat, amt]) => (
                  <span
                    key={cat}
                    className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300"
                  >
                    {cat} ·{" "}
                    <span className="text-rose-300 tabular-nums">
                      {fmt(amt)}/mo
                    </span>
                  </span>
                ))}
              </div>
            )}

            {expenses.length === 0 && !showAddExpense ? (
              <p className="text-sm text-slate-600 py-4 text-center">
                No expenses added yet
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {expenses.map((f) => (
                  <FlowRow
                    key={f.id}
                    flow={f}
                    primary={primaryCurrency}
                    rates={rates}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── PROJECTIONS ── */}
      {activeSection === "projections" && (
        <div className="flex flex-col gap-5">
          {/* Horizon selector */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest">
              Projection horizon
            </p>
            <div className="flex flex-wrap gap-2">
              {HORIZON_OPTIONS.map((o) => (
                <button
                  key={o.months}
                  onClick={() => {
                    setHorizonMonths(o.months);
                    setCustomHorizon("");
                    setIncludeDate("");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    horizonMonths === o.months && !customHorizon && !includeDate
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Custom (months)</label>
                <input
                  className={inputCls}
                  value={customHorizon}
                  onChange={(e) => {
                    setCustomHorizon(e.target.value.replace(/\D/g, ""));
                    setIncludeDate("");
                  }}
                  inputMode="numeric"
                  placeholder="e.g. 18"
                />
              </div>
              <div>
                <label className={labelCls}>Or: project up to date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={includeDate}
                  onChange={(e) => {
                    setIncludeDate(e.target.value);
                    setCustomHorizon("");
                  }}
                />
              </div>
            </div>
          </div>

          {/* Key outcome cards */}
          {projection.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
                  Starting Balance
                </p>
                <p className="text-lg font-bold text-slate-100 tabular-nums">
                  {fmt(totalSavings)}
                </p>
              </div>
              <div
                className={`p-4 rounded-2xl border ${finalBalance >= totalSavings ? "bg-emerald-900/25 border-emerald-800/50" : "bg-rose-900/25 border-rose-800/50"}`}
              >
                <p
                  className={`text-xs uppercase tracking-widest mb-1 ${finalBalance >= totalSavings ? "text-emerald-400" : "text-rose-400"}`}
                >
                  Projected Balance
                </p>
                <p
                  className={`text-lg font-bold tabular-nums ${finalBalance >= totalSavings ? "text-emerald-200" : "text-rose-200"}`}
                >
                  {fmt(finalBalance)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  in {effectiveHorizon} months
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
                  Total Income
                </p>
                <p className="text-lg font-bold text-emerald-300 tabular-nums">
                  {fmt(projection.reduce((s, r) => s + r.income, 0))}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
                  Total Expenses
                </p>
                <p className="text-lg font-bold text-rose-300 tabular-nums">
                  {fmt(projection.reduce((s, r) => s + r.expenses, 0))}
                </p>
              </div>
            </div>
          )}

          {flows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
              <span className="text-4xl">📊</span>
              <p className="text-sm">
                Add income and expenses in the Flows tab to see projections
              </p>
            </div>
          ) : (
            projection.length > 0 && (
              <>
                {/* Balance over time */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-200 mb-4">
                    Balance Over Time
                  </h3>
                  <ResponsiveContainer
                    width="100%"
                    height={260}
                  >
                    <AreaChart
                      data={projection}
                      margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
                    >
                      <defs>
                        <linearGradient
                          id="gBal"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#6366f1"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="95%"
                            stopColor="#6366f1"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1e293b"
                      />
                      <XAxis
                        dataKey="label"
                        tick={axisStyle}
                        interval={Math.max(
                          0,
                          Math.floor(projection.length / 8) - 1,
                        )}
                      />
                      <YAxis
                        tick={axisStyle}
                        tickFormatter={(v) =>
                          `$${Math.abs(v / 1000).toFixed(0)}k`
                        }
                        width={60}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v) => [
                          typeof v === "number" ? fmt(v) : v,
                          "Balance",
                        ]}
                      />
                      <ReferenceLine
                        y={0}
                        stroke="#475569"
                        strokeDasharray="4 4"
                      />
                      <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="#6366f1"
                        fill="url(#gBal)"
                        strokeWidth={2}
                        dot={false}
                        name="Balance"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Monthly income vs expenses */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-200 mb-4">
                    Monthly Income vs Expenses
                  </h3>
                  <ResponsiveContainer
                    width="100%"
                    height={240}
                  >
                    <BarChart
                      data={projection}
                      margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
                      barSize={effectiveHorizon > 24 ? 4 : 10}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1e293b"
                      />
                      <XAxis
                        dataKey="label"
                        tick={axisStyle}
                        interval={Math.max(
                          0,
                          Math.floor(projection.length / 8) - 1,
                        )}
                      />
                      <YAxis
                        tick={axisStyle}
                        tickFormatter={(v) =>
                          `$${Math.abs(v / 1000).toFixed(0)}k`
                        }
                        width={60}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v) => [typeof v === "number" ? fmt(v) : v]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
                      />
                      <Bar
                        dataKey="income"
                        name="Income"
                        fill="#34d399"
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar
                        dataKey="expenses"
                        name="Expenses"
                        fill="#f87171"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Monthly net cash flow */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-200 mb-4">
                    Monthly Net Cash Flow
                  </h3>
                  <ResponsiveContainer
                    width="100%"
                    height={200}
                  >
                    <BarChart
                      data={projection}
                      margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
                      barSize={effectiveHorizon > 24 ? 4 : 10}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1e293b"
                      />
                      <XAxis
                        dataKey="label"
                        tick={axisStyle}
                        interval={Math.max(
                          0,
                          Math.floor(projection.length / 8) - 1,
                        )}
                      />
                      <YAxis
                        tick={axisStyle}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        width={60}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v) => [
                          typeof v === "number" ? fmt(v) : v,
                          "Net",
                        ]}
                      />
                      <ReferenceLine
                        y={0}
                        stroke="#475569"
                        strokeDasharray="4 4"
                      />
                      <Bar
                        dataKey="net"
                        name="Net"
                        radius={[3, 3, 0, 0]}
                        fill="#818cf8"
                        label={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Monthly breakdown table (condensed) */}
                {effectiveHorizon <= 24 && (
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
                    <h3 className="text-sm font-bold text-slate-200 mb-3">
                      Monthly Breakdown
                    </h3>
                    <table className="w-full text-sm text-left min-w-[400px]">
                      <thead>
                        <tr className="text-xs text-slate-500 border-b border-slate-700">
                          <th className="pb-2 pr-4 font-medium">Month</th>
                          <th className="pb-2 pr-4 font-medium text-right text-emerald-500">
                            Income
                          </th>
                          <th className="pb-2 pr-4 font-medium text-right text-rose-500">
                            Expenses
                          </th>
                          <th className="pb-2 pr-4 font-medium text-right">
                            Net
                          </th>
                          <th className="pb-2 font-medium text-right">
                            Balance
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {projection.map((row, i) => (
                          <tr
                            key={i}
                            className="border-b border-slate-800/60 text-slate-300 hover:bg-slate-800/40"
                          >
                            <td className="py-2 pr-4 font-semibold text-slate-100">
                              {row.label}
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums text-emerald-400">
                              {row.income > 0 ? fmt(row.income) : "—"}
                            </td>
                            <td className="py-2 pr-4 text-right tabular-nums text-rose-400">
                              {row.expenses > 0 ? fmt(row.expenses) : "—"}
                            </td>
                            <td
                              className={`py-2 pr-4 text-right tabular-nums font-medium ${row.net >= 0 ? "text-indigo-300" : "text-amber-300"}`}
                            >
                              {row.net >= 0 ? "+" : "−"}
                              {fmt(row.net)}
                            </td>
                            <td className="py-2 text-right tabular-nums">
                              {fmt(row.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}

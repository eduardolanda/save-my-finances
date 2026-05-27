import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { PROVINCES, type ProvinceCode } from "./components/mortgage/provinces";

import { useRegisterSW } from "virtual:pwa-register/react";
import logo from "./assets/logo.png";
import {
  useSavings,
  usePrimaryCurrency,
  useFxRates,
  addSaving,
  useFlows,
} from "./hooks";
import { exportData, importData, clearData } from "./dataIO";
import { convert, formatMoney } from "./currency";
import { type SavingEntry } from "./db";
import { monthlyAmount } from "./components/IncomeExpenses";
import { calcTax, ZERO_DEDUCTIONS } from "./components/income/taxes";
import SavingCard from "./components/SavingCard";
import SavingForm from "./components/SavingForm";
import CurrencySelector from "./components/CurrencySelector";
import MortgageCalculator from "./components/MortgageCalculator";
import IncomeExpenses from "./components/IncomeExpenses";
import InstallPrompt from "./components/InstallPrompt";
import Dashboard from "./components/Dashboard";

type Tab = "dashboard" | "savings" | "mortgage" | "income" | "settings";
type FilterCategory = "all" | SavingEntry["category"];

const CATEGORY_ICON: Record<string, string> = {
  cash: "💵",
  bank: "🏦",
  stocks: "📈",
  rrsp: "🇨🇦",
};

export default function App() {
  const validTabs: Tab[] = [
    "dashboard",
    "savings",
    "mortgage",
    "income",
    "settings",
  ];
  const hashTab = window.location.hash.replace("#", "") as Tab;
  const [activeTab, setActiveTab] = useState<Tab>(
    validTabs.includes(hashTab) ? hashTab : "dashboard",
  );

  const navigate = useCallback((tab: Tab) => {
    window.location.hash = tab;
    setActiveTab(tab);
  }, []);

  useEffect(() => {
    const onHash = () => {
      const t = window.location.hash.replace("#", "") as Tab;
      if (validTabs.includes(t)) setActiveTab(t);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const savings = useSavings();
  const flows = useFlows();
  const { primary, setPrimary } = usePrimaryCurrency();
  const { rates, loading: ratesLoading, offline } = useFxRates(primary);

  const monthlyIncome = useMemo(
    () =>
      flows
        .filter((f) => f.kind === "income")
        .reduce((s, f) => s + monthlyAmount(f, primary, rates), 0),
    [flows, primary, rates],
  );

  const monthlyExpenses = useMemo(
    () =>
      flows
        .filter((f) => f.kind === "expense")
        .reduce((s, f) => s + monthlyAmount(f, primary, rates), 0),
    [flows, primary, rates],
  );
  const [confirmClear, setConfirmClear] = useState(false);

  async function handleClearData() {
    await clearData();
    setConfirmClear(false);
    window.location.reload();
  }

  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<FilterCategory>("all");

  const filtered = useMemo(
    () =>
      filter === "all" ? savings : savings.filter((s) => s.category === filter),
    [savings, filter],
  );

  const amountById = useMemo(() => {
    const map = new Map<number, number>();
    for (const s of filtered) {
      map.set(
        s.id!,
        rates ? convert(s.amount, s.currency, primary, rates) : s.amount,
      );
    }
    return map;
  }, [filtered, rates, primary]);

  const maxAmount = Math.max(1, ...amountById.values());

  const totalInPrimary = useMemo(
    () => [...amountById.values()].reduce((a, b) => a + b, 0),
    [amountById],
  );

  const groups = useMemo(() => {
    const map = new Map<string, SavingEntry[]>();
    for (const s of filtered) {
      const key = s.group?.trim() || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [filtered]);

  async function handleAdd(
    data: Omit<SavingEntry, "id" | "createdAt" | "updatedAt">,
  ) {
    await addSaving(data);
    setShowAdd(false);
  }

  const FILTERS: FilterCategory[] = ["all", "cash", "bank", "stocks", "rrsp"];

  const importInputRef = useRef<HTMLInputElement>(null);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importData(file);
      window.location.reload();
    } catch (err) {
      alert(
        `Import failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      e.target.value = "";
    }
  }

  const { updateServiceWorker } = useRegisterSW();

  // ── Theme ──────────────────────────────────────────────────────
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("vq-theme");
    return stored ? stored === "dark" : true; // default dark for continuity
  });
  const toggleTheme = () => setIsDark((d) => !d);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("vq-theme", isDark ? "dark" : "light");
  }, [isDark]);

  // ── Province ────────────────────────────────────────────────────
  const [province, setProvince] = useState<ProvinceCode>(() => {
    return (localStorage.getItem("vq-province") as ProvinceCode) ?? "BC";
  });
  useEffect(() => {
    localStorage.setItem("vq-province", province);
  }, [province]);

  const effectiveTaxRate = useMemo(() => {
    const annualGross = monthlyIncome * 12;
    if (
      annualGross <= 0 ||
      !flows.some((f) => f.kind === "income" && f.deductTax)
    )
      return 0;
    return calcTax(annualGross, province, ZERO_DEDUCTIONS).effectiveRate;
  }, [monthlyIncome, flows, province]);

  const monthlyIncomeNet = useMemo(
    () =>
      flows
        .filter((f) => f.kind === "income")
        .reduce(
          (s, f) => s + monthlyAmount(f, primary, rates, effectiveTaxRate),
          0,
        ),
    [flows, primary, rates, effectiveTaxRate],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ── Header + Tab bar (sticky together) ── */}
      <div className="sticky top-0 z-40">
        {/* ── Header ── */}
        <header className="bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="La Vaquita"
              className="h-8 w-8 rounded-lg"
            />
            <span className="text-xl font-bold tracking-tight">La Vaquita</span>
            {offline && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900 text-amber-300 font-semibold">
                Offline
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <CurrencySelector
              current={primary}
              onChange={setPrimary}
            />
            {/* Province selector — compact, shows code only */}
            <select
              value={province}
              onChange={(e) => setProvince(e.target.value as ProvinceCode)}
              title="Select your province / territory"
              className="px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-indigo-500 text-slate-200 text-sm font-semibold transition outline-none focus:border-indigo-500 cursor-pointer"
            >
              {PROVINCES.map((p) => (
                <option
                  key={p.code}
                  value={p.code}
                >
                  {p.code}
                </option>
              ))}
            </select>
            <button
              onClick={toggleTheme}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition text-base leading-none"
            >
              {isDark ? "☀️" : "🌙"}
            </button>
            {activeTab === "savings" && (
              <button
                onClick={() => setShowAdd(true)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
              >
                + Add
              </button>
            )}
          </div>
        </header>

        {/* ── Tab bar ── */}
        <nav className="bg-slate-950 border-b border-slate-800 flex">
          {(
            [
              { id: "dashboard", label: "🏠 Home", short: "🏠\nHome" },
              { id: "savings", label: "🏦 Savings", short: "🏦\nSavings" },
              {
                id: "income",
                label: "💸 Income & Expenses",
                short: "💸\nIncome",
              },
              { id: "mortgage", label: "📐 Mortgage", short: "📐\nMortgage" },
              { id: "settings", label: "⚙️ Settings", short: "⚙️\nSettings" },
            ] as { id: Tab; label: string; short: string }[]
          ).map(({ id, label, short }) => (
            <button
              key={id}
              onClick={() => navigate(id)}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition -mb-px text-center leading-tight ${
                activeTab === id
                  ? "border-indigo-500 text-indigo-300"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden flex flex-col items-center gap-0.5">
                <span>{short.split("\n")[0]}</span>
                <span className="text-[10px]">{short.split("\n")[1]}</span>
              </span>
            </button>
          ))}
        </nav>
      </div>

      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full">
        {/* ── PWA install prompt ── */}
        <div className="flex flex-col gap-2 mb-6">
          <InstallPrompt />
        </div>

        {/* ── Dashboard tab ── */}
        {activeTab === "dashboard" && (
          <Dashboard
            savings={savings}
            primaryCurrency={primary}
            rates={rates}
            totalSavings={totalInPrimary}
            monthlyIncome={monthlyIncomeNet}
            monthlyExpenses={monthlyExpenses}
            navigate={(tab) => navigate(tab as Tab)}
          />
        )}

        {/* ── Savings tab ── */}
        {activeTab === "savings" && (
          <>
            {/* Total banner */}
            <div className="mb-6 p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
                  Total ({primary})
                </p>
                <p className="text-2xl sm:text-4xl font-bold text-slate-100 tabular-nums">
                  {formatMoney(totalInPrimary, primary)}
                </p>
                {ratesLoading && (
                  <p className="text-xs text-slate-500 mt-1">
                    Updating exchange rates…
                  </p>
                )}
              </div>
              <div className="hidden sm:flex flex-col gap-1 text-right">
                {(["cash", "bank", "stocks", "rrsp"] as FilterCategory[]).map(
                  (cat) => {
                    const catTotal = savings
                      .filter((s) => s.category === cat)
                      .reduce(
                        (sum, s) =>
                          sum +
                          (rates
                            ? convert(s.amount, s.currency, primary, rates)
                            : s.amount),
                        0,
                      );
                    if (catTotal === 0) return null;
                    return (
                      <p
                        key={cat}
                        className="text-xs text-slate-400"
                      >
                        <span className="mr-1">{CATEGORY_ICON[cat]}</span>
                        <span className="font-semibold text-slate-200 tabular-nums">
                          {formatMoney(catTotal, primary)}
                        </span>
                        <span className="ml-1 text-slate-500">{cat}</span>
                      </p>
                    );
                  },
                )}
              </div>
            </div>

            {/* Category filter */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                    filter === f
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {f !== "all" && (
                    <span className="mr-1">{CATEGORY_ICON[f]}</span>
                  )}
                  {f.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Add form */}
            {showAdd && (
              <div className="mb-6 p-5 rounded-2xl bg-slate-900 border border-slate-700">
                <p className="text-sm text-slate-400 mb-4">New saving entry</p>
                <SavingForm
                  onSave={handleAdd}
                  onCancel={() => setShowAdd(false)}
                />
              </div>
            )}

            {/* Empty state */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
                <span className="text-5xl">🏦</span>
                <p className="text-lg">No savings yet</p>
                <button
                  onClick={() => setShowAdd(true)}
                  className="mt-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
                >
                  Add your first entry
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {[...groups.entries()].map(([groupName, entries]) => {
                  const groupTotal = entries.reduce(
                    (sum, s) => sum + (amountById.get(s.id!) ?? 0),
                    0,
                  );
                  return (
                    <section key={groupName}>
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-slate-100">
                            {groupName}
                          </span>
                          <span className="text-xs text-slate-500">
                            {entries.length}{" "}
                            {entries.length === 1 ? "account" : "accounts"}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-slate-300 tabular-nums">
                          {formatMoney(groupTotal, primary)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-4">
                        {entries.map((entry) => (
                          <SavingCard
                            key={entry.id}
                            entry={entry}
                            primaryCurrency={primary}
                            rates={rates}
                            weight={
                              (amountById.get(entry.id!) ?? 0) / maxAmount
                            }
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Income & Expenses tab ── */}
        {activeTab === "income" && (
          <IncomeExpenses
            primaryCurrency={primary}
            rates={rates}
            totalSavings={totalInPrimary}
            province={province}
          />
        )}

        {/* ── Settings tab ── */}
        {activeTab === "settings" && (
          <div className="flex flex-col gap-6 max-w-md">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImport}
            />
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-4">
              <h2 className="text-base font-bold text-slate-100">
                ⚙️ Settings
              </h2>

              <div className="flex flex-col gap-2">
                <p className="text-xs text-slate-400 uppercase tracking-widest">
                  Data
                </p>
                <button
                  onClick={() => exportData()}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition text-left flex items-center gap-3"
                >
                  <span className="text-lg">📤</span>
                  <div>
                    <p>Export data</p>
                    <p className="text-xs font-normal text-slate-500">
                      Download a backup of all your savings, flows &amp;
                      settings
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => importInputRef.current?.click()}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition text-left flex items-center gap-3"
                >
                  <span className="text-lg">📥</span>
                  <div>
                    <p>Import data</p>
                    <p className="text-xs font-normal text-slate-500">
                      Restore from a previously exported backup (replaces
                      current data)
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                <p className="text-xs text-slate-400 uppercase tracking-widest">
                  Appearance
                </p>
                <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-800">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      {isDark ? "Dark mode" : "Light mode"}
                    </p>
                    <p className="text-xs font-normal text-slate-500">
                      Toggle light / dark theme
                    </p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    aria-label="Toggle theme"
                    className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${isDark ? "bg-indigo-600" : "bg-slate-400"}`}
                  >
                    <span
                      className={`absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow transition-transform ${isDark ? "translate-x-7" : "translate-x-1"}`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                <p className="text-xs text-slate-400 uppercase tracking-widest">
                  Danger zone
                </p>
                {!confirmClear ? (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="w-full px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-red-900/60 text-red-400 text-sm font-semibold transition text-left flex items-center gap-3"
                  >
                    <span className="text-lg">🗑️</span>
                    <div>
                      <p>Clear all data</p>
                      <p className="text-xs font-normal text-slate-500">
                        Delete all savings, flows, settings and preferences
                      </p>
                    </div>
                  </button>
                ) : (
                  <div className="p-4 rounded-lg bg-red-950/50 border border-red-800 flex flex-col gap-3">
                    <p className="text-sm text-red-300 font-semibold">Are you sure? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleClearData}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-bold transition"
                      >
                        Yes, delete everything
                      </button>
                      <button
                        onClick={() => setConfirmClear(false)}
                        className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                <p className="text-xs text-slate-400 uppercase tracking-widest">
                  App
                </p>
                <button
                  onClick={() => updateServiceWorker(true)}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition text-left flex items-center gap-3"
                >
                  <span className="text-lg">↻</span>
                  <div>
                    <p>Force update</p>
                    <p className="text-xs font-normal text-slate-500">
                      The app updates automatically — tap this if something
                      looks outdated
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Mortgage tab ── */}
        {activeTab === "mortgage" && (
          <>
            {/* Savings available banner */}
            <div className="mb-5 p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-widest mb-0.5">
                  Available Savings ({primary})
                </p>
                <p className="text-2xl font-bold text-emerald-300 tabular-nums">
                  {formatMoney(totalInPrimary, primary)}
                </p>
              </div>
              <div className="hidden sm:flex flex-col gap-1 text-right">
                {(["cash", "bank", "stocks", "rrsp"] as FilterCategory[]).map(
                  (cat) => {
                    const catTotal = savings
                      .filter((s) => s.category === cat)
                      .reduce(
                        (sum, s) =>
                          sum +
                          (rates
                            ? convert(s.amount, s.currency, primary, rates)
                            : s.amount),
                        0,
                      );
                    if (catTotal === 0) return null;
                    return (
                      <p
                        key={cat}
                        className="text-xs text-slate-400"
                      >
                        <span className="mr-1">{CATEGORY_ICON[cat]}</span>
                        <span className="font-semibold text-slate-200 tabular-nums">
                          {formatMoney(catTotal, primary)}
                        </span>
                        <span className="ml-1 text-slate-500">{cat}</span>
                      </p>
                    );
                  },
                )}
              </div>
            </div>
            <MortgageCalculator
              monthlyIncome={monthlyIncomeNet}
              monthlyExpenses={monthlyExpenses}
              province={province}
            />
          </>
        )}
      </main>

      <footer className="text-center text-xs text-slate-700 py-4">
        Data stored locally in your browser · works offline
      </footer>
    </div>
  );
}

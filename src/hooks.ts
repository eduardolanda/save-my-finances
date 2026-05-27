import { useLiveQuery } from "dexie-react-hooks";
import { useState, useEffect, useCallback } from "react";
import { db, getSetting, setSetting, type SavingEntry, type FlowEntry } from "./db";
import { fetchRates, type FxRates } from "./currency";

// ── Savings ──────────────────────────────────────────────────────────────────

export function useSavings() {
  const savings = useLiveQuery(
    () => db.savings.toArray().then((a) => a.sort((x, y) => x.createdAt - y.createdAt)),
    [],
  );
  return savings ?? [];
}

export function useGroups(): string[] {
  const groups = useLiveQuery(async () => {
    const all = await db.savings.toArray();
    return [...new Set(all.map((s) => s.group).filter((g) => typeof g === "string" && g !== ""))].sort();
  }, []);
  return groups ?? [];
}

export async function addSaving(
  entry: Omit<SavingEntry, "id" | "createdAt" | "updatedAt">,
) {
  const now = Date.now();
  await db.savings.add({ ...entry, createdAt: now, updatedAt: now });
}

export async function updateSaving(
  id: number,
  patch: Partial<Omit<SavingEntry, "id">>,
) {
  await db.savings.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteSaving(id: number) {
  await db.savings.delete(id);
}

// ── Income / Expense flows ────────────────────────────────────────────────────

export function useFlows() {
  const flows = useLiveQuery(
    () => db.flows.toArray().then((a) => a.sort((x, y) => x.createdAt - y.createdAt)),
    [],
  );
  return flows ?? [];
}

export async function addFlow(entry: Omit<FlowEntry, "id" | "createdAt" | "updatedAt">) {
  const now = Date.now();
  await db.flows.add({ ...entry, createdAt: now, updatedAt: now });
}

export async function updateFlow(id: number, patch: Partial<Omit<FlowEntry, "id">>) {
  await db.flows.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteFlow(id: number) {
  await db.flows.delete(id);
}

// ── Primary currency ─────────────────────────────────────────────────────────

export function usePrimaryCurrency() {
  const [primary, setPrimaryState] = useState<string>("CAD");

  useEffect(() => {
    getSetting("primaryCurrency").then((v) => {
      if (v) setPrimaryState(v);
    });
  }, []);

  const setPrimary = useCallback(async (currency: string) => {
    setPrimaryState(currency);
    await setSetting("primaryCurrency", currency);
  }, []);

  return { primary, setPrimary };
}

// ── FX Rates ─────────────────────────────────────────────────────────────────

export function useFxRates(baseCurrency: string) {
  const [rates, setRates] = useState<FxRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchRates(baseCurrency).then((r) => {
      setRates(r);
      setLoading(false);
    });
  }, [baseCurrency]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchRates(baseCurrency).then((r) => {
      setRates(r);
      setLoading(false);
    });
  }, [baseCurrency]);

  return { rates, loading, offline, refresh };
}

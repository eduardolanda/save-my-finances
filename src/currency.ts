// Currency conversion via exchangerate-api (free, no key needed for open endpoint)
// Falls back gracefully when offline – uses cached rates stored in localStorage.

export const POPULAR_CURRENCIES = [
  "CAD",
  "USD",
  "EUR",
  "GBP",
  "MXN",
  "AUD",
  "CHF",
  "JPY",
  "BRL",
  "CNY",
];

const CACHE_KEY = "smf_fx_rates";
const CACHE_TS_KEY = "smf_fx_ts";
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

export interface FxRates {
  base: string;
  rates: Record<string, number>;
}

function loadCached(): FxRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FxRates;
  } catch {
    return null;
  }
}

function saveCache(data: FxRates) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  localStorage.setItem(CACHE_TS_KEY, Date.now().toString());
}

function isCacheStale(): boolean {
  const ts = localStorage.getItem(CACHE_TS_KEY);
  if (!ts) return true;
  return Date.now() - Number(ts) > CACHE_TTL_MS;
}

export async function fetchRates(baseCurrency: string): Promise<FxRates> {
  if (!isCacheStale()) {
    const cached = loadCached();
    if (cached && cached.base === baseCurrency) return cached;
  }

  try {
    const res = await fetch(
      `https://open.er-api.com/v6/latest/${baseCurrency}`,
    );
    if (!res.ok) throw new Error("Network response not ok");
    const json = await res.json();
    const data: FxRates = { base: baseCurrency, rates: json.rates };
    saveCache(data);
    return data;
  } catch {
    const cached = loadCached();
    if (cached) return cached;
    // If totally offline with no cache, return 1:1
    return { base: baseCurrency, rates: { [baseCurrency]: 1 } };
  }
}

export function convert(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: FxRates,
): number {
  if (fromCurrency === toCurrency) return amount;
  // rates are relative to base
  const toBase =
    fromCurrency === rates.base
      ? amount
      : amount / (rates.rates[fromCurrency] ?? 1);
  return toBase * (rates.rates[toCurrency] ?? 1);
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

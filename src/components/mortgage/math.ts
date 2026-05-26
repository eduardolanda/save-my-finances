import type { PayFreq, LumpFreq, PeriodRow, YearRow, ScheduleResult, GstInfo } from "./types";

// ── Mortgage type presets (posted rates, indicative only) ─────────────────────
export const MORTGAGE_TYPES: { id: string; label: string; rate: number | null }[] = [
  { id: "custom",      label: "Custom Rate",                    rate: null },
  { id: "6m-closed",   label: "6 month closed",                 rate: 7.2  },
  { id: "6m-open",     label: "6 month open",                   rate: 8.2  },
  { id: "1y-open",     label: "1 year open",                    rate: 7.7  },
  { id: "1y-closed",   label: "1 year closed",                  rate: 6.89 },
  { id: "2y-closed",   label: "2 year closed",                  rate: 6.29 },
  { id: "3y-closed",   label: "3 year closed",                  rate: 5.89 },
  { id: "4y-closed",   label: "4 year closed",                  rate: 5.69 },
  { id: "5y-closed",   label: "5 year closed",                  rate: 5.25 },
  { id: "7y-closed",   label: "7 year closed",                  rate: 6.1  },
  { id: "10y-closed",  label: "10 year closed",                 rate: 6.45 },
  { id: "5y-var-closed", label: "5 year variable rate closed",  rate: 6.45 },
  { id: "5y-var-open", label: "5 year variable rate open",      rate: 7.2  },
  { id: "3y-ult-var",  label: "3 year ultimate variable rate",  rate: 6.7  },
];

// ── Canadian mortgage math ────────────────────────────────────────────────────
export function periodsPerYear(freq: PayFreq): number {
  return { monthly: 12, "semi-monthly": 24, "bi-weekly": 26, weekly: 52 }[freq];
}

export function effectiveRatePerPeriod(annual: number, freq: PayFreq): number {
  return Math.pow(1 + annual / 2, 2 / periodsPerYear(freq)) - 1;
}

export function calcPayment(
  principal: number,
  annual: number,
  years: number,
  freq: PayFreq,
): number {
  if (principal <= 0 || annual <= 0)
    return principal / (years * periodsPerYear(freq));
  const r = effectiveRatePerPeriod(annual, freq);
  const n = years * periodsPerYear(freq);
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// ── CMHC ─────────────────────────────────────────────────────────────────────
function cmhcRate(dp: number, price: number): number {
  const pct = dp / price;
  if (pct >= 0.2 || price >= 1_500_000) return 0;
  if (pct < 0.1) return 0.04;
  if (pct < 0.15) return 0.031;
  return 0.028;
}

export function calcCMHC(price: number, dp: number): number {
  return (price - dp) * cmhcRate(dp, price);
}

export function minDP(price: number): number {
  if (price >= 1_000_000) return price * 0.2;
  if (price > 500_000) return 25_000 + (price - 500_000) * 0.1;
  return price * 0.05;
}

// ── BC Property Transfer Tax ──────────────────────────────────────────────────
export function calcPTT(
  price: number,
  ftb: boolean,
  newConstruction: boolean,
  foreign: boolean,
): number {
  // New construction PTT exemption (≤$1.1M, principal residence)
  if (newConstruction && price <= 1_100_000) return 0;

  // Standard PTT brackets
  let tax = 0;
  if (price <= 200_000) tax = price * 0.01;
  else if (price <= 2_000_000) tax = 2_000 + (price - 200_000) * 0.02;
  else if (price <= 3_000_000) tax = 38_000 + (price - 2_000_000) * 0.03;
  else tax = 68_000 + (price - 3_000_000) * 0.05;

  // First-time buyer exemption (effective Apr 1 2024); foreign entities not eligible
  if (ftb && !newConstruction && !foreign) {
    // Full exemption: price ≤ $835,000
    if (price <= 835_000) {
      const taxOnExcess = price > 500_000 ? (price - 500_000) * 0.02 : 0;
      return taxOnExcess;
    }
    // Partial exemption: $835,000 < price < $860,000
    if (price < 860_000) {
      const fullExemptionSaving = 500_000 * 0.02;
      const taper = (860_000 - price) / (860_000 - 835_000);
      return tax - fullExemptionSaving * taper;
    }
    // ≥ $860,000 — no exemption
  }
  return tax;
}

// ── GST on new construction ───────────────────────────────────────────────────
export function calcGST(price: number, isInvestment: boolean): GstInfo {
  const gst = price * 0.05;
  let rebate = 0;
  if (!isInvestment) {
    if (price <= 350_000) rebate = Math.min(gst * 0.36, 6_300);
    else if (price < 450_000)
      rebate = Math.min(gst * 0.36, 6_300) * (1 - (price - 350_000) / 100_000);
  }
  return { gst, rebate, net: gst - rebate };
}

// ── Full amortization schedule ────────────────────────────────────────────────
export function buildSchedule(
  principal: number,
  annual: number,
  years: number,
  freq: PayFreq,
  extraAmount: number,
  extraFreq: LumpFreq,
  payIncrAmt: number,
  payIncrFreq: LumpFreq,
): ScheduleResult {
  const ppy = periodsPerYear(freq);
  const r = effectiveRatePerPeriod(annual, freq);
  const basePmt = calcPayment(principal, annual, years, freq);
  const maxP = years * ppy;
  const periods: PeriodRow[] = [];
  const yearRows: YearRow[] = [];
  let balance = principal;
  let totalInterest = 0;
  let payoffPeriod = maxP;

  for (let p = 1; p <= maxP; p++) {
    let pmt = basePmt;
    if (payIncrAmt > 0) {
      if (payIncrFreq === "once") {
        pmt = basePmt + payIncrAmt;
      } else if (payIncrFreq === "annually") {
        pmt = basePmt + payIncrAmt * (Math.floor((p - 1) / ppy) + 1);
      } else {
        const halfPeriods = Math.round(ppy / 2);
        pmt = basePmt + payIncrAmt * (Math.floor((p - 1) / halfPeriods) + 1);
      }
    }

    const interest = balance * r;
    const principalPaid = Math.min(pmt - interest, balance);

    const halfPpy = Math.round(ppy / 2);
    const isLump =
      extraAmount > 0 &&
      (extraFreq === "once"
        ? p === ppy
        : extraFreq === "annually"
          ? p % ppy === 0
          : p % halfPpy === 0);
    const extra = isLump ? Math.min(extraAmount, balance - principalPaid) : 0;

    balance = Math.max(0, balance - principalPaid - extra);
    totalInterest += interest;
    periods.push({ period: p, interest, principal: principalPaid, balance, extra });

    if (p % ppy === 0 || balance <= 0) {
      const yr = Math.ceil(p / ppy);
      const slice = periods.filter(
        (x) => x.period > (yr - 1) * ppy && x.period <= yr * ppy,
      );
      yearRows.push({
        year: yr,
        interest: slice.reduce((s, x) => s + x.interest, 0),
        principal: slice.reduce((s, x) => s + x.principal, 0),
        extra: slice.reduce((s, x) => s + x.extra, 0),
        balance,
      });
    }

    if (balance <= 0) {
      payoffPeriod = p;
      break;
    }
  }

  return { periods, yearRows, totalInterest, payoffPeriod };
}

// ── Formatting ────────────────────────────────────────────────────────────────
const CAD = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});
const CAD2 = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 2,
});

export const fmt = (n: number) => CAD.format(n);
export const fmt2 = (n: number) => CAD2.format(n);

export function fmtCommas(raw: string): string {
  const [int, dec] = raw.split(".");
  return dec !== undefined
    ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + dec
    : int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function parseN(s: string): number {
  return parseFloat(s.replace(/,/g, "")) || 0;
}

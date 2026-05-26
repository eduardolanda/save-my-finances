// ── Province definitions & land transfer tax calculations ─────────────────────

export type ProvinceCode =
  | "BC"
  | "AB"
  | "SK"
  | "MB"
  | "ON"
  | "QC"
  | "NB"
  | "NS"
  | "PE"
  | "NL"
  | "NT"
  | "YT"
  | "NU";

export const PROVINCES: { code: ProvinceCode; name: string }[] = [
  { code: "BC", name: "British Columbia" },
  { code: "AB", name: "Alberta" },
  { code: "SK", name: "Saskatchewan" },
  { code: "MB", name: "Manitoba" },
  { code: "ON", name: "Ontario" },
  { code: "QC", name: "Québec" },
  { code: "NB", name: "New Brunswick" },
  { code: "NS", name: "Nova Scotia" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "NL", name: "Newfoundland & Labrador" },
  { code: "NT", name: "Northwest Territories" },
  { code: "YT", name: "Yukon" },
  { code: "NU", name: "Nunavut" },
];

export interface LttResult {
  /** Net land transfer tax after exemptions/rebates */
  tax: number;
  /** Additional foreign-buyer tax (0 if not applicable) */
  foreignTax: number;
  /** Display label for the main LTT row */
  taxLabel: string;
  /** Optional explanatory sub-text for the LTT row */
  taxSub?: string;
  /** Display label for the foreign-tax row (only set when foreignTax > 0) */
  foreignTaxLabel?: string;
}

/** Returns true when the province charges an additional foreign-buyer tax. */
export function hasForeignBuyerTax(p: ProvinceCode): boolean {
  return p === "BC";
}

/** Returns true when the province offers an LTT exemption for new construction. */
export function hasNewConstructionExemption(p: ProvinceCode): boolean {
  return p === "BC";
}

/** Province-specific sub-text for the first-time buyer checkbox. */
export function ftbNote(p: ProvinceCode): string {
  switch (p) {
    case "BC":
      return "Exempt on first $500k if price ≤$835k · partial $835k–$860k";
    case "ON":
      return "Rebate up to $4,000 on provincial LTT";
    case "MB":
      return "Full LTT rebate on homes ≤$500,000";
    case "AB":
    case "SK":
    case "NL":
    case "NT":
    case "YT":
    case "NU":
      return "No provincial land transfer tax in this province";
    default:
      return "Land transfer tax rebates may apply — verify with provincial authority";
  }
}

// ── Province-specific calculators ─────────────────────────────────────────────

function calcBC(
  price: number,
  ftb: boolean,
  newConstruction: boolean,
  foreign: boolean,
): LttResult {
  // New construction PTT exemption — principal residence ≤$1.1M
  if (newConstruction && price <= 1_100_000) {
    return {
      tax: 0,
      foreignTax: 0,
      taxLabel: "Property Transfer Tax (PTT)",
      taxSub: "New construction ≤$1.1M — PTT exempt (principal residence)",
    };
  }

  // Standard PTT brackets
  let tax = 0;
  if (price <= 200_000) tax = price * 0.01;
  else if (price <= 2_000_000) tax = 2_000 + (price - 200_000) * 0.02;
  else if (price <= 3_000_000) tax = 38_000 + (price - 2_000_000) * 0.03;
  else tax = 68_000 + (price - 3_000_000) * 0.05;

  let taxSub: string | undefined;

  // First-time buyer exemption (Apr 2024 rules); foreign entities not eligible
  if (ftb && !foreign) {
    if (price <= 835_000) {
      const taxOnExcess = price > 500_000 ? (price - 500_000) * 0.02 : 0;
      tax = taxOnExcess;
      taxSub = "Exempt on first $500,000 of purchase price (Apr 2024 rules)";
    } else if (price < 860_000) {
      const fullSaving = 500_000 * 0.02;
      const taper = (860_000 - price) / (860_000 - 835_000);
      tax = tax - fullSaving * taper;
      taxSub = "Partial exemption — price $835k–$860k taper applied";
    } else {
      taxSub = "No exemption — price exceeds $860,000 threshold";
    }
  } else if (ftb && foreign) {
    taxSub = "Foreign buyers are not eligible for the FTB exemption";
  }

  const foreignTax = foreign ? price * 0.2 : 0;

  return {
    tax,
    foreignTax,
    taxLabel: `Property Transfer Tax (PTT)${ftb ? " — First-Time Buyer" : ""}`,
    taxSub,
    foreignTaxLabel: foreign
      ? "Additional PTT — Foreign Buyer (20%)"
      : undefined,
  };
}

function calcON(price: number, ftb: boolean): LttResult {
  // Ontario LTT brackets
  let tax = 0;
  if (price <= 55_000) tax = price * 0.005;
  else if (price <= 250_000) tax = 275 + (price - 55_000) * 0.01;
  else if (price <= 400_000) tax = 2_225 + (price - 250_000) * 0.015;
  else if (price <= 2_000_000) tax = 4_475 + (price - 400_000) * 0.02;
  else tax = 36_475 + (price - 2_000_000) * 0.025;

  // FTB rebate capped at $4,000
  const ftbRebate = ftb ? Math.min(tax, 4_000) : 0;
  tax -= ftbRebate;

  return {
    tax,
    foreignTax: 0,
    taxLabel: "Land Transfer Tax (LTT)",
    taxSub: ftb
      ? "FTB rebate of up to $4,000 applied · Toronto residents pay an additional Municipal LTT (same brackets) with an extra FTB rebate up to $4,475"
      : "Toronto residents also pay a Municipal Land Transfer Tax at the same brackets",
  };
}

function calcAB(price: number): LttResult {
  // Alberta has no provincial LTT — only a small Land Title Transfer fee
  // Estimate: $50 base + $2 per $5,000 of purchase price
  const fee = Math.round(50 + Math.ceil(price / 5_000) * 2);
  return {
    tax: fee,
    foreignTax: 0,
    taxLabel: "Land Title Transfer Fee (est.)",
    taxSub:
      "Alberta has no provincial land transfer tax — small administrative fee only",
  };
}

function calcQC(price: number): LttResult {
  // Welcome Tax (Taxe de bienvenue) — provincial base 2024 brackets
  let tax = 0;
  if (price <= 58_900) tax = price * 0.005;
  else if (price <= 294_600) tax = 294.5 + (price - 58_900) * 0.01;
  else if (price <= 552_300) tax = 2_651 + (price - 294_600) * 0.015;
  else if (price <= 1_054_200) tax = 6_516.5 + (price - 552_300) * 0.02;
  else tax = 16_554.5 + (price - 1_054_200) * 0.025;

  return {
    tax,
    foreignTax: 0,
    taxLabel: "Welcome Tax (Taxe de bienvenue)",
    taxSub:
      "Montréal adds 2% on $500k–$1M and 2.5% above $1M · no first-time buyer exemption in QC",
  };
}

function calcMB(price: number, ftb: boolean): LttResult {
  // Manitoba LTT brackets
  let tax = 0;
  if (price <= 30_000) tax = 0;
  else if (price <= 90_000) tax = (price - 30_000) * 0.005;
  else if (price <= 150_000) tax = 300 + (price - 90_000) * 0.01;
  else if (price <= 200_000) tax = 900 + (price - 150_000) * 0.015;
  else tax = 1_650 + (price - 200_000) * 0.02;

  // FTB: full rebate on principal residence ≤$500,000
  const ftbRebate = ftb && price <= 500_000 ? tax : 0;
  tax -= ftbRebate;

  return {
    tax,
    foreignTax: 0,
    taxLabel: "Land Transfer Tax",
    taxSub:
      ftb && price <= 500_000
        ? "First-time buyers may qualify for full LTT rebate on homes ≤$500,000"
        : undefined,
  };
}

function calcNB(price: number): LttResult {
  return {
    tax: price * 0.01,
    foreignTax: 0,
    taxLabel: "Land Transfer Tax (1%)",
  };
}

function calcNS(price: number): LttResult {
  return {
    tax: price * 0.015,
    foreignTax: 0,
    taxLabel: "Deed Transfer Tax (~1.5%)",
    taxSub: "Rate varies by municipality; 1.5% (Halifax/HRM rate) shown",
  };
}

function calcPE(price: number): LttResult {
  return {
    tax: price * 0.01,
    foreignTax: 0,
    taxLabel: "Real Property Transfer Tax (1%)",
  };
}

function noLTT(): LttResult {
  return {
    tax: 0,
    foreignTax: 0,
    taxLabel: "Land Registration Fee (nominal)",
    taxSub: "No provincial land transfer tax",
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

export function calcLTT(
  province: ProvinceCode,
  price: number,
  ftb: boolean,
  newConstruction: boolean,
  foreign: boolean,
): LttResult {
  switch (province) {
    case "BC":
      return calcBC(price, ftb, newConstruction, foreign);
    case "AB":
      return calcAB(price);
    case "SK":
      return noLTT();
    case "MB":
      return calcMB(price, ftb);
    case "ON":
      return calcON(price, ftb);
    case "QC":
      return calcQC(price);
    case "NB":
      return calcNB(price);
    case "NS":
      return calcNS(price);
    case "PE":
      return calcPE(price);
    case "NL":
    case "NT":
    case "YT":
    case "NU":
      return noLTT();
    default:
      return noLTT();
  }
}

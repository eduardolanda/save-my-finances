/**
 * Canadian income tax estimation — 2024 tax year values.
 * For planning purposes only. Consult a tax professional for accurate figures.
 */
import type { ProvinceCode } from "../mortgage/provinces";

export const TAX_DISCLAIMER =
  "2024 tax-year rates · estimates for planning only · consult a tax professional";

// ── Bracket helper ─────────────────────────────────────────────────────────────
function bracketTax(
  income: number,
  brackets: [limit: number, rate: number][],
): number {
  let tax = 0;
  let prev = 0;
  for (const [limit, rate] of brackets) {
    if (income <= prev) break;
    tax += (Math.min(income, limit) - prev) * rate;
    prev = limit;
    if (income <= limit) break;
  }
  return tax;
}

// ── Federal ───────────────────────────────────────────────────────────────────
const FED_BPA = 15_705;

const FED_BRACKETS: [number, number][] = [
  [55_867, 0.15],
  [111_733, 0.205],
  [154_906, 0.26],
  [220_000, 0.29],
  [Infinity, 0.33],
];

/** Marginal federal rate for a given taxable income */
function fedMarginalRate(income: number): number {
  for (const [limit, rate] of FED_BRACKETS) {
    if (income <= limit) return rate;
  }
  return 0.33;
}

// ── CPP employee contributions (2024) ─────────────────────────────────────────
const CPP_EXEMPTION = 3_500;
const CPP1_YMPE = 68_500; // Year's Maximum Pensionable Earnings
const CPP1_RATE = 0.0595;
const CPP2_YMPE = 73_200; // CPP2 ceiling
const CPP2_RATE = 0.04;

export function calcCPP(gross: number): number {
  const cpp1 =
    Math.max(0, Math.min(gross, CPP1_YMPE) - CPP_EXEMPTION) * CPP1_RATE;
  const cpp2 = Math.max(0, Math.min(gross, CPP2_YMPE) - CPP1_YMPE) * CPP2_RATE;
  return cpp1 + cpp2;
}

// ── EI employee premiums (2024) ───────────────────────────────────────────────
const EI_MAX_INSURABLE = 63_200;
const EI_RATE_ROC = 0.0166; // rest of Canada
const EI_RATE_QC = 0.0127; // Québec (lower — pays QPIP separately)

export function calcEI(gross: number, province: ProvinceCode): number {
  const rate = province === "QC" ? EI_RATE_QC : EI_RATE_ROC;
  return Math.min(gross, EI_MAX_INSURABLE) * rate;
}

// ── Provincial configs ─────────────────────────────────────────────────────────
interface ProvinceTaxConfig {
  bpa: number;
  brackets: [limit: number, rate: number][];
  /** Quebec: 16.5% federal abatement */
  federalAbatement?: number;
  /** Ontario surtax — applied on top of basic provincial tax */
  surtax?: { t1: number; t2: number };
}

const PROVINCE_CONFIGS: Partial<Record<ProvinceCode, ProvinceTaxConfig>> = {
  BC: {
    bpa: 11_981,
    brackets: [
      [45_654, 0.0506],
      [91_310, 0.077],
      [104_835, 0.105],
      [127_299, 0.1229],
      [172_602, 0.147],
      [240_716, 0.168],
      [Infinity, 0.205],
    ],
  },
  AB: {
    bpa: 21_003,
    brackets: [
      [148_269, 0.1],
      [177_922, 0.12],
      [237_230, 0.13],
      [355_845, 0.14],
      [Infinity, 0.15],
    ],
  },
  SK: {
    bpa: 17_661,
    brackets: [
      [49_720, 0.105],
      [142_058, 0.125],
      [Infinity, 0.145],
    ],
  },
  MB: {
    bpa: 15_780,
    brackets: [
      [36_842, 0.108],
      [79_625, 0.1275],
      [Infinity, 0.174],
    ],
  },
  ON: {
    bpa: 11_865,
    brackets: [
      [51_446, 0.0505],
      [102_894, 0.0915],
      [150_000, 0.1116],
      [220_000, 0.1216],
      [Infinity, 0.1316],
    ],
    surtax: { t1: 5_315, t2: 6_802 },
  },
  QC: {
    bpa: 17_183,
    brackets: [
      [51_780, 0.14],
      [103_545, 0.19],
      [126_000, 0.24],
      [Infinity, 0.2575],
    ],
    federalAbatement: 0.165,
  },
  NB: {
    bpa: 12_458,
    brackets: [
      [47_715, 0.094],
      [95_431, 0.14],
      [176_756, 0.16],
      [Infinity, 0.195],
    ],
  },
  NS: {
    bpa: 8_481,
    brackets: [
      [29_590, 0.0879],
      [59_180, 0.1495],
      [93_000, 0.1667],
      [150_000, 0.175],
      [Infinity, 0.21],
    ],
  },
  PE: {
    bpa: 12_000,
    brackets: [
      [32_656, 0.0965],
      [64_313, 0.1363],
      [105_000, 0.1665],
      [140_000, 0.18],
      [Infinity, 0.1875],
    ],
  },
  NL: {
    bpa: 10_818,
    brackets: [
      [43_198, 0.087],
      [86_395, 0.145],
      [154_244, 0.158],
      [215_943, 0.178],
      [275_870, 0.198],
      [551_739, 0.208],
      [Infinity, 0.213],
    ],
  },
  NT: {
    bpa: 16_593,
    brackets: [
      [50_597, 0.059],
      [101_198, 0.086],
      [164_525, 0.122],
      [Infinity, 0.1405],
    ],
  },
  YT: {
    bpa: 15_705,
    brackets: [
      [55_867, 0.064],
      [111_733, 0.09],
      [154_906, 0.109],
      [500_000, 0.128],
      [Infinity, 0.15],
    ],
  },
  NU: {
    bpa: 17_925,
    brackets: [
      [50_877, 0.04],
      [101_754, 0.07],
      [165_429, 0.09],
      [Infinity, 0.115],
    ],
  },
};

// ── Main result types ──────────────────────────────────────────────────────────
export interface TaxBreakdown {
  grossAnnual: number;
  taxableIncome: number;
  rrspDeduction: number;
  otherDeductions: number;
  federalTax: number;
  provincialTax: number;
  cpp: number;
  ei: number;
  totalIncomeTax: number; // federal + provincial
  totalWithholding: number; // all deductions from gross (taxes + CPP + EI)
  netAnnual: number;
  netMonthly: number;
  effectiveRate: number; // totalWithholding / grossAnnual
  marginalFederal: number;
  marginalProvincial: number;
  marginalCombined: number;
}

export interface DeductionInputs {
  rrsp: number;
  unionDues: number;
  childcare: number;
  homeOffice: number; // WFH days × $2
  movingExpenses: number;
  studentLoanInterest: number;
  other: number;
}

export const ZERO_DEDUCTIONS: DeductionInputs = {
  rrsp: 0,
  unionDues: 0,
  childcare: 0,
  homeOffice: 0,
  movingExpenses: 0,
  studentLoanInterest: 0,
  other: 0,
};

export function calcTax(
  grossAnnual: number,
  province: ProvinceCode,
  deductions: DeductionInputs,
): TaxBreakdown {
  const totalDeductions =
    deductions.rrsp +
    deductions.unionDues +
    deductions.childcare +
    deductions.homeOffice +
    deductions.movingExpenses +
    deductions.studentLoanInterest +
    deductions.other;

  const taxableIncome = Math.max(0, grossAnnual - totalDeductions);
  const config = PROVINCE_CONFIGS[province];

  // ── Federal ──
  const fedBrackTax = bracketTax(taxableIncome, FED_BRACKETS);
  const fedBpaCredit = FED_BPA * 0.15;
  let federalTax = Math.max(0, fedBrackTax - fedBpaCredit);

  // Student loan interest → non-refundable federal credit at 15%
  const studentLoanCredit = deductions.studentLoanInterest * 0.15;
  federalTax = Math.max(0, federalTax - studentLoanCredit);

  // Quebec abatement
  if (config?.federalAbatement) {
    federalTax = Math.max(0, federalTax * (1 - config.federalAbatement));
  }

  // ── Provincial ──
  let provincialTax = 0;
  if (config) {
    const provBrackTax = bracketTax(taxableIncome, config.brackets);
    const provBpaCredit = config.bpa * config.brackets[0][1]; // BPA × lowest rate
    provincialTax = Math.max(0, provBrackTax - provBpaCredit);

    // Ontario surtax
    if (config.surtax) {
      const { t1, t2 } = config.surtax;
      let surtax = 0;
      if (provincialTax > t1)
        surtax += (Math.min(provincialTax, t2) - t1) * 0.2;
      if (provincialTax > t2) surtax += (provincialTax - t2) * 0.36;
      provincialTax += surtax;
    }
  }

  // ── CPP / EI ──
  const cpp = Math.min(calcCPP(grossAnnual), calcCPP(grossAnnual)); // already capped in calcCPP
  const ei = calcEI(grossAnnual, province);

  const totalIncomeTax = federalTax + provincialTax;
  const totalWithholding = totalIncomeTax + cpp + ei;
  const netAnnual = grossAnnual - totalWithholding;

  // Marginal rates (at taxable income)
  const marginalFederal = fedMarginalRate(taxableIncome);
  const marginalProvincial = config
    ? (() => {
        for (const [limit, rate] of config.brackets) {
          if (taxableIncome <= limit) return rate;
        }
        return config.brackets[config.brackets.length - 1][1];
      })()
    : 0;

  return {
    grossAnnual,
    taxableIncome,
    rrspDeduction: deductions.rrsp,
    otherDeductions: totalDeductions - deductions.rrsp,
    federalTax,
    provincialTax,
    cpp,
    ei,
    totalIncomeTax,
    totalWithholding,
    netAnnual,
    netMonthly: netAnnual / 12,
    effectiveRate: grossAnnual > 0 ? totalWithholding / grossAnnual : 0,
    marginalFederal,
    marginalProvincial,
    marginalCombined: marginalFederal + marginalProvincial,
  };
}

// ── RRSP limits ────────────────────────────────────────────────────────────────
export const RRSP_MAX_2024 = 31_560;

export function rrspLimit(grossAnnual: number): number {
  return Math.min(grossAnnual * 0.18, RRSP_MAX_2024);
}

// ── Province-specific deduction/credit tips ────────────────────────────────────
export interface TaxTip {
  title: string;
  description: string;
  federal: boolean;
}

export function getTaxTips(province: ProvinceCode): TaxTip[] {
  const tips: TaxTip[] = [
    {
      title: "RRSP Contribution",
      description: `Up to 18% of prior year's earned income (max $${RRSP_MAX_2024.toLocaleString()}). Reduces taxable income dollar-for-dollar — biggest tax lever available.`,
      federal: true,
    },
    {
      title: "TFSA (Tax-Free Savings Account)",
      description:
        "Doesn't reduce taxable income but all growth is tax-free. Ideal for after-tax savings. 2024 room: $7,000 + unused prior years.",
      federal: true,
    },
    {
      title: "Union / Professional Dues",
      description:
        "Dues required for employment are fully deductible. Reported on your T4 Box 44.",
      federal: true,
    },
    {
      title: "Home Office Expenses",
      description:
        "Flat rate: $2/day WFH (max 250 days = $500). Detailed method allows actual expenses if employer signs T2200.",
      federal: true,
    },
    {
      title: "Childcare Expenses",
      description:
        "Up to $8,000/child under 7, $5,000 for 7–16. Must be earned income (lower-earner spouse usually claims).",
      federal: true,
    },
    {
      title: "Moving Expenses",
      description:
        "Deductible if you moved 40+ km closer to a new job or school. Keep receipts.",
      federal: true,
    },
    {
      title: "Student Loan Interest",
      description:
        "15% non-refundable federal credit on interest paid on eligible student loans.",
      federal: true,
    },
  ];

  // Province-specific tips
  switch (province) {
    case "BC":
      tips.push(
        {
          title: "BC Renter's Tax Credit",
          description:
            "Up to $400/year for renters paying rent on their principal residence in BC.",
          federal: false,
        },
        {
          title: "BC Family Benefit",
          description:
            "Monthly tax-free benefit for families with children under 18. Up to $2,188/child/year.",
          federal: false,
        },
        {
          title: "BC Training Tax Credit",
          description:
            "For apprentices in eligible trades — up to $2,500 credit.",
          federal: false,
        },
      );
      break;
    case "ON":
      tips.push(
        {
          title: "Ontario Trillium Benefit (OTB)",
          description:
            "Monthly benefit combining Ontario Energy and Property Tax Credit, Northern Ontario Energy Credit, and Ontario Sales Tax Credit. Up to $1,500+/year.",
          federal: false,
        },
        {
          title: "Ontario Staycation Tax Credit",
          description:
            "20% refundable credit on eligible Ontario leisure accommodation expenses (up to $1,000 individuals / $2,000 families).",
          federal: false,
        },
        {
          title: "Ontario Seniors' Home Safety Tax Credit",
          description:
            "25% refundable credit on eligible home renovation costs that improve safety for seniors.",
          federal: false,
        },
      );
      break;
    case "AB":
      tips.push(
        {
          title: "No Provincial Sales Tax",
          description:
            "Alberta has no PST — your take-home effectively stretches further than in other provinces.",
          federal: false,
        },
        {
          title: "Alberta Child and Family Benefit",
          description:
            "Quarterly payments for lower/middle-income families with children under 18. Up to ~$2,900/year for first child.",
          federal: false,
        },
      );
      break;
    case "QC":
      tips.push(
        {
          title: "QC Solidarity Tax Credit",
          description:
            "Combines housing component, QST component, and northern village component. Can be worth $1,000+ per year.",
          federal: false,
        },
        {
          title: "QPP / QPIP Deductions",
          description:
            "Quebec Pension Plan (QPP) employee contributions are deductible on the Quebec return. QPIP premiums also deductible provincially.",
          federal: false,
        },
        {
          title: "QC Work Premium Tax Credit",
          description:
            "Refundable credit based on earned income — up to $1,178 for a single person.",
          federal: false,
        },
        {
          title: "QC Childcare Subsidy",
          description:
            "Subsidized daycare at ~$10–$15/day. Also a provincial refundable childcare credit.",
          federal: false,
        },
      );
      break;
    case "MB":
      tips.push(
        {
          title: "Manitoba Primary Caregiver Tax Credit",
          description:
            "$1,400 refundable credit for unpaid caregivers looking after someone eligible for the Disability Tax Credit.",
          federal: false,
        },
        {
          title: "MB Education Property Tax Credit",
          description:
            "Homeowners and renters can claim a credit on education property taxes paid.",
          federal: false,
        },
      );
      break;
    case "SK":
      tips.push(
        {
          title: "SK Active Families Benefit",
          description:
            "Refundable credit of $150/child for sports/cultural activity fees — reduced at higher incomes.",
          federal: false,
        },
        {
          title: "SK Graduate Retention Program",
          description:
            "Graduates who work in Saskatchewan can claim a tuition rebate as a provincial tax credit over 7 years.",
          federal: false,
        },
      );
      break;
    case "NS":
      tips.push(
        {
          title: "NS Poverty Reduction Tax Credit",
          description:
            "Annual credit of up to $625 for lower-income Nova Scotians.",
          federal: false,
        },
        {
          title: "NS Volunteer Firefighters / Rescue Workers",
          description:
            "$500 refundable credit for active volunteer firefighters or search and rescue workers.",
          federal: false,
        },
      );
      break;
    case "NB":
      tips.push({
        title: "NB Seniors' Home Renovation Tax Credit",
        description:
          "15% non-refundable credit (up to $10,000 in expenses = max $1,500) for home renovations that improve accessibility.",
        federal: false,
      });
      break;
    case "PE":
      tips.push({
        title: "PEI Volunteer Firefighter Tax Credit",
        description:
          "$500 refundable credit for active PEI volunteer firefighters.",
        federal: false,
      });
      break;
    case "NL":
      tips.push({
        title: "NL Resort Property Tax Credit",
        description:
          "For purchasers of eligible resort properties in certain NL areas.",
        federal: false,
      });
      break;
    default:
      break;
  }

  return tips;
}

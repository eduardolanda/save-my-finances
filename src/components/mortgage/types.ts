export type PayFreq = "monthly" | "semi-monthly" | "bi-weekly" | "weekly";
export type LumpFreq = "once" | "annually" | "semi-annually";

export interface PeriodRow {
  period: number;
  interest: number;
  principal: number;
  balance: number;
  extra: number;
}

export interface YearRow {
  year: number;
  interest: number;
  principal: number;
  extra: number;
  balance: number;
}

export interface ScheduleResult {
  periods: PeriodRow[];
  yearRows: YearRow[];
  totalInterest: number;
  payoffPeriod: number;
}

export interface GstInfo {
  gst: number;
  rebate: number;
  net: number;
}

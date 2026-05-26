import Dexie, { type Table } from "dexie";

export type SavingCategory = "cash" | "bank" | "stocks" | "rrsp";
export type FlowFrequency =
  | "once"
  | "weekly"
  | "bi-weekly"
  | "semi-monthly"
  | "monthly"
  | "quarterly"
  | "semi-annually"
  | "annually";

export interface SavingEntry {
  id?: number;
  name: string;
  group: string;
  category: SavingCategory;
  currency: string;
  amount: number;
  createdAt: number;
  updatedAt: number;
}

export interface FlowEntry {
  id?: number;
  kind: "income" | "expense";
  name: string;
  amount: number;
  currency: string;
  recurrent: boolean;
  frequency: FlowFrequency;
  /** ISO date string — when this flow starts (defaults to today) */
  startDate: string;
  /** ISO date string — when it ends; undefined = never */
  endDate?: string;
  /** Expense category tag (optional) */
  category?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  id?: number;
  key: string;
  value: string;
}

class FinancesDB extends Dexie {
  savings!: Table<SavingEntry, number>;
  flows!: Table<FlowEntry, number>;
  settings!: Table<Settings, number>;

  constructor() {
    super("save-my-finances");
    this.version(1).stores({
      savings: "++id, category, group, currency, createdAt",
      settings: "++id, &key",
    });
    this.version(2).stores({
      savings: "++id, category, group, currency, createdAt",
      flows: "++id, kind, recurrent, createdAt",
      settings: "++id, &key",
    });
  }
}

export const db = new FinancesDB();

// Settings helpers
export async function getSetting(key: string): Promise<string | null> {
  const row = await db.settings.where("key").equals(key).first();
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const existing = await db.settings.where("key").equals(key).first();
  if (existing?.id != null) {
    await db.settings.update(existing.id, { value });
  } else {
    await db.settings.add({ key, value });
  }
}

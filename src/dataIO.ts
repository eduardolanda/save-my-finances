import { db } from "./db";

const PREF_KEYS = ["vq-province", "vq-tax-deductions", "vq-tax-grossOverride"] as const;

export interface ExportData {
  version: 1;
  exportedAt: string;
  savings: object[];
  flows: object[];
  settings: object[];
  preferences?: Record<string, string>;
}

/** Dumps all IndexedDB data (savings, flows, settings) to a JSON file download. */
export async function exportData(): Promise<void> {
  const [savings, flows, settings] = await Promise.all([
    db.savings.toArray(),
    db.flows.toArray(),
    db.settings.toArray(),
  ]);

  const preferences: Record<string, string> = {};
  for (const key of PREF_KEYS) {
    const v = localStorage.getItem(key);
    if (v !== null) preferences[key] = v;
  }

  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    savings,
    flows,
    settings,
    preferences,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `save-my-finances-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Wipes all IndexedDB tables and app localStorage keys. */
export async function clearData(): Promise<void> {
  await db.transaction("rw", [db.savings, db.flows, db.settings], async () => {
    await db.savings.clear();
    await db.flows.clear();
    await db.settings.clear();
  });
  for (const key of PREF_KEYS) {
    localStorage.removeItem(key);
  }
}
export async function importData(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text) as ExportData;

  if (data.version !== 1)
    throw new Error(`Unsupported export version: ${data.version}`);

  await db.transaction("rw", [db.savings, db.flows, db.settings], async () => {
    await db.savings.clear();
    await db.flows.clear();
    await db.settings.clear();

    // Strip auto-incremented ids so Dexie assigns fresh ones
    const strip = (rows: object[]) =>
      rows.map((row) => {
        const { id: _id, ...rest } = row as Record<string, unknown>;
        return rest;
      });

    if (data.savings?.length)
      await db.savings.bulkAdd(strip(data.savings) as never[]);
    if (data.flows?.length)
      await db.flows.bulkAdd(strip(data.flows) as never[]);
    if (data.settings?.length)
      await db.settings.bulkAdd(strip(data.settings) as never[]);
  });

  // Restore localStorage preferences
  if (data.preferences) {
    for (const key of PREF_KEYS) {
      if (key in data.preferences) {
        localStorage.setItem(key, data.preferences[key]);
      }
    }
  }
}

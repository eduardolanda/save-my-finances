import React, { useState } from "react";
import { type SavingCategory, type SavingEntry } from "../db";
import { POPULAR_CURRENCIES } from "../currency";
import { useGroups } from "../hooks";
import AutocompleteInput from "./AutocompleteInput";

const CATEGORIES: SavingCategory[] = ["cash", "bank", "stocks", "rrsp"];

interface Props {
  initial?: Partial<SavingEntry>;
  onSave: (data: Omit<SavingEntry, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}

export default function SavingForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [group, setGroup] = useState(initial?.group ?? "");
  const groups = useGroups();
  const [category, setCategory] = useState<SavingCategory>(
    initial?.category ?? "bank",
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "CAD");
  const [amount, setAmount] = useState(
    initial?.amount != null ? formatWithCommas(String(initial.amount)) : "",
  );

  function formatWithCommas(raw: string): string {
    const [integer, decimal] = raw.split(".");
    const formatted = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decimal !== undefined ? `${formatted}.${decimal}` : formatted;
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Strip everything except digits and one decimal point
    const stripped = e.target.value
      .replace(/[^0-9.]/g, "")
      .replace(/(\..*)\./g, "$1");
    setAmount(formatWithCommas(stripped));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount.replace(/,/g, ""));
    if (!name.trim() || isNaN(parsed) || parsed < 0) return;
    onSave({
      name: name.trim(),
      group: group.trim(),
      category,
      currency,
      amount: parsed,
    });
  }

  const inputCls =
    "w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 transition";
  const labelCls = "block text-xs text-slate-400 mb-1";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
    >
      <div>
        <label className={labelCls}>Name</label>
        <input
          className={inputCls}
          placeholder="e.g. TD Savings"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className={labelCls}>Group / Institution</label>
        <AutocompleteInput
          value={group}
          onChange={setGroup}
          suggestions={groups}
          placeholder="e.g. TD Bank"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Category</label>
          <select
            className={inputCls}
            value={category}
            onChange={(e) => setCategory(e.target.value as SavingCategory)}
          >
            {CATEGORIES.map((c) => (
              <option
                key={c}
                value={c}
              >
                {c.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Currency</label>
          <select
            className={inputCls}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {POPULAR_CURRENCIES.map((c) => (
              <option
                key={c}
                value={c}
              >
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Amount</label>
        <input
          className={`${inputCls} tabular-nums`}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={handleAmountChange}
          required
        />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition"
        >
          Save
        </button>
      </div>
    </form>
  );
}

import { useState } from "react";
import { type SavingEntry } from "../db";
import { type FxRates, convert, formatMoney } from "../currency";
import SavingForm from "./SavingForm";
import { updateSaving, deleteSaving } from "../hooks";

const CATEGORY_COLORS: Record<string, string> = {
  cash: "from-emerald-600 to-emerald-800",
  bank: "from-indigo-600 to-indigo-800",
  stocks: "from-amber-500 to-amber-700",
  rrsp: "from-rose-600 to-rose-800",
};

const CATEGORY_BADGE: Record<string, string> = {
  cash: "bg-emerald-900 text-emerald-300",
  bank: "bg-indigo-900 text-indigo-300",
  stocks: "bg-amber-900 text-amber-300",
  rrsp: "bg-rose-900 text-rose-300",
};

interface Props {
  entry: SavingEntry;
  primaryCurrency: string;
  rates: FxRates | null;
  /** normalized 0–1 weight used to size the box */
  weight: number;
}

export default function SavingCard({
  entry,
  primaryCurrency,
  rates,
  weight,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const convertedAmount = rates
    ? convert(entry.amount, entry.currency, primaryCurrency, rates)
    : null;

  // Size: min 120px, max 320px, proportional to weight
  const size = Math.round(120 + weight * 200);

  const gradient =
    CATEGORY_COLORS[entry.category] ?? "from-slate-600 to-slate-800";
  const badge = CATEGORY_BADGE[entry.category] ?? "bg-slate-700 text-slate-300";

  async function handleSave(
    data: Omit<SavingEntry, "id" | "createdAt" | "updatedAt">,
  ) {
    if (entry.id == null) return;
    await updateSaving(entry.id, data);
    setEditing(false);
  }

  async function handleDelete() {
    if (entry.id == null) return;
    await deleteSaving(entry.id);
  }

  if (editing) {
    return (
      <div className="col-span-full rounded-2xl bg-slate-800 border border-slate-700 p-5">
        <p className="text-sm text-slate-400 mb-4">Edit "{entry.name}"</p>
        <SavingForm
          initial={entry}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-2xl bg-gradient-to-br ${gradient} p-4 flex flex-col justify-between shadow-lg cursor-pointer group transition-transform hover:scale-105 aspect-square`}
      style={{ width: size, maxWidth: '100%', minWidth: 120, minHeight: 120 }}
      onClick={() => setEditing(true)}
    >
      {/* Badges */}
      <div className="flex items-start justify-between gap-1 flex-wrap">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}
        >
          {entry.category.toUpperCase()}
        </span>
        {entry.currency !== primaryCurrency && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-black/30 text-white/70">
            {entry.currency}
          </span>
        )}
      </div>

      {/* Amount */}
      <div className="mt-auto">
        <p
          className="text-white font-bold leading-tight truncate"
          style={{ fontSize: Math.max(14, Math.min(22, size / 9)) }}
        >
          {convertedAmount != null
            ? formatMoney(convertedAmount, primaryCurrency)
            : formatMoney(entry.amount, entry.currency)}
        </p>
        {convertedAmount != null && entry.currency !== primaryCurrency && (
          <p className="text-white/60 text-xs truncate">
            {formatMoney(entry.amount, entry.currency)}
          </p>
        )}
        <p className="text-white/80 text-sm font-medium truncate mt-0.5">
          {entry.name}
        </p>
        {entry.group && (
          <p className="text-white/50 text-xs truncate">{entry.group}</p>
        )}
      </div>

      {/* Delete button – always visible on mobile, hover on desktop */}
      <div className="absolute top-2 right-2 flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDelete(true);
          }}
          className="p-1.5 rounded-lg bg-black/40 hover:bg-red-600/80 text-white text-xs"
          title="Delete"
        >
          🗑️
        </button>
      </div>

      {/* Delete confirm overlay */}
      {confirmDelete && (
        <div
          className="absolute inset-0 rounded-2xl bg-black/80 flex flex-col items-center justify-center gap-3 p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-white text-sm text-center">Delete this entry?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

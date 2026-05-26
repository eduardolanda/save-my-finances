import { useState } from "react";
import { POPULAR_CURRENCIES } from "../currency";

interface Props {
  current: string;
  onChange: (currency: string) => void;
}

export default function CurrencySelector({ current, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-indigo-500 text-slate-200 text-sm font-semibold transition"
      >
        <span>{current}</span>
        <span className="text-slate-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2 flex flex-wrap gap-1 w-56">
          {POPULAR_CURRENCIES.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                c === current
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

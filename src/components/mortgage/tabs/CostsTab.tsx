import { fmt } from "../math";
import { PROVINCES } from "../provinces";
import type { GstInfo } from "../types";
import type { LttResult, ProvinceCode } from "../provinces";

interface CostsTabProps {
  province: ProvinceCode;
  lttResult: LttResult;
  gstInfo: GstInfo | null;
  totalClosing: number;
  downPayment: number;
  cashToClose: number;
}

export default function CostsTab({
  province,
  lttResult,
  gstInfo,
  totalClosing,
  downPayment,
  cashToClose,
}: CostsTabProps) {
  const provinceName =
    PROVINCES.find((p) => p.code === province)?.name ?? province;

  const rows: {
    label: string;
    value: string;
    sub?: string;
    highlight?: boolean;
  }[] = [
    {
      label: lttResult.taxLabel,
      value: lttResult.tax === 0 ? "—" : fmt(lttResult.tax),
      sub: lttResult.taxSub,
      highlight: lttResult.tax === 0,
    },
    ...(gstInfo
      ? [
          { label: "GST on New Construction (5%)", value: fmt(gstInfo.gst) },
          {
            label: "Federal GST New Housing Rebate",
            value:
              gstInfo.rebate > 0
                ? `−${fmt(gstInfo.rebate)}`
                : "None (price > $450k)",
            highlight: gstInfo.rebate > 0,
          },
        ]
      : []),
    ...(lttResult.foreignTax > 0
      ? [
          {
            label: lttResult.foreignTaxLabel ?? "Foreign Buyer Tax",
            value: fmt(lttResult.foreignTax),
          },
        ]
      : []),
    { label: "Legal / Notary Fees (est.)", value: "~$1,500" },
    { label: "Home Inspection (est.)", value: "~$500" },
    { label: "Title Insurance (est.)", value: "~$300" },
  ];

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
      <h3 className="text-sm font-bold text-slate-200 mb-1">
        🍁 {provinceName} Closing Costs
      </h3>

      {rows.map((row) => (
        <div
          key={row.label}
          className="flex justify-between items-start gap-4"
        >
          <div>
            <span
              className={`text-sm ${row.highlight ? "text-emerald-400" : "text-slate-300"}`}
            >
              {row.label}
            </span>
            {row.sub && (
              <p className="text-xs text-slate-500 mt-0.5">{row.sub}</p>
            )}
          </div>
          <span
            className={`text-sm font-semibold tabular-nums shrink-0 ${
              row.highlight ? "text-emerald-400" : "text-slate-200"
            }`}
          >
            {row.value}
          </span>
        </div>
      ))}

      <div className="border-t border-slate-700 pt-3 flex flex-col gap-2">
        <div className="flex justify-between">
          <span className="text-sm font-semibold text-slate-200">
            Total Closing Costs
          </span>
          <span className="text-sm font-bold text-white tabular-nums">
            {fmt(totalClosing)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-400">Down Payment</span>
          <span className="text-sm tabular-nums text-slate-300">
            {fmt(downPayment)}
          </span>
        </div>
        <div className="flex justify-between pt-1 border-t border-slate-800">
          <span className="text-sm font-bold text-slate-100">
            Cash Needed to Close
          </span>
          <span className="text-sm font-bold text-indigo-300 tabular-nums">
            {fmt(cashToClose)}
          </span>
        </div>
      </div>
    </div>
  );
}

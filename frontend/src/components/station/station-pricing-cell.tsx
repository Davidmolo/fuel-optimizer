import {
  formatDiscountPercent,
  formatDiscountSavings,
  formatPricePerGallon,
  getStationDiscount,
} from "@/lib/station-utils";
import type { FuelStation } from "@/types/station";

type StationPricingCellProps = {
  station: Pick<FuelStation, "retailPricePerUnit" | "discountedPricePerUnit">;
};

export default function StationPricingCell({ station }: StationPricingCellProps) {
  const discount = getStationDiscount(station);
  const hasRetail = station.retailPricePerUnit !== undefined;
  const hasContract = station.discountedPricePerUnit !== undefined;

  if (!hasRetail && !hasContract) {
    return <span className="text-xs text-muted">No pricing</span>;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Contract</span>
        <span className="tabular-nums font-semibold text-primary">
          {formatPricePerGallon(station.discountedPricePerUnit ?? station.retailPricePerUnit)}
        </span>
      </div>

      {hasRetail ? (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted">Retail</span>
          <span className={`tabular-nums text-sm ${discount ? "text-muted line-through" : "text-foreground"}`}>
            {formatPricePerGallon(station.retailPricePerUnit)}
          </span>
        </div>
      ) : null}

      {discount ? (
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium tabular-nums text-emerald-700 ring-1 ring-emerald-100">
            {formatDiscountSavings(discount.savingsPerGallon)}
          </span>
          <span className="text-xs tabular-nums text-emerald-700/80">{formatDiscountPercent(discount.savingsPercent)}</span>
        </div>
      ) : hasRetail && hasContract ? (
        <span className="text-xs text-muted">No discount</span>
      ) : null}
    </div>
  );
}

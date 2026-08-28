import { formatDiscountSavings, getStationDiscount } from "@/lib/station-utils";
import type { FuelStation } from "@/types/station";

type StationDiscountBadgeProps = {
  station: Pick<FuelStation, "retailPricePerUnit" | "discountedPricePerUnit">;
};

export default function StationDiscountBadge({ station }: StationDiscountBadgeProps) {
  const discount = getStationDiscount(station);

  if (!discount) {
    return null;
  }

  return (
    <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium tabular-nums text-emerald-700 ring-1 ring-emerald-100">
      {formatDiscountSavings(discount.savingsPerGallon)}
    </span>
  );
}

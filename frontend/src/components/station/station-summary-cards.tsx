import Card from "@/components/common/card";
import { formatDiscountSavings, type StationDiscountSummary } from "@/lib/station-utils";
import type { RelayDriverListResponse, StationListResponse } from "@/types/station";

type SummaryCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

function SummaryCard({ label, value, hint }: SummaryCardProps) {
  return (
    <Card compact>
      <p className="stat-label">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

type StationSummaryCardsProps = {
  stationSummary?: StationListResponse["summary"];
  driverSummary?: RelayDriverListResponse;
  discountSummary?: StationDiscountSummary;
};

export default function StationSummaryCards({
  stationSummary,
  driverSummary,
  discountSummary,
}: StationSummaryCardsProps) {
  const discountRate =
    stationSummary?.stationCount && discountSummary
      ? `${Math.round((discountSummary.stationsWithDiscount / stationSummary.stationCount) * 100)}%`
      : "—";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <SummaryCard
        label="Relay drivers"
        value={driverSummary?.driverCount ?? 0}
        hint="Synced from both merchant accounts"
      />
      <SummaryCard label="Stations cached" value={stationSummary?.stationCount ?? 0} hint="From Relay transactions" />
      <SummaryCard
        label="Merchants"
        value={stationSummary?.merchantCount ?? 0}
        hint={`${stationSummary?.stateCount ?? 0} states`}
      />
      <SummaryCard
        label="With Relay discount"
        value={discountSummary?.stationsWithDiscount ?? 0}
        hint={
          discountSummary
            ? `${discountRate} of stations · avg $${discountSummary.averageSavingsPerGallon.toFixed(3)}/gal saved`
            : "Contract price below retail"
        }
      />
      <SummaryCard
        label="Best savings"
        value={
          discountSummary?.maxSavingsPerGallon
            ? formatDiscountSavings(discountSummary.maxSavingsPerGallon)
            : "—"
        }
        hint={
          discountSummary?.stationsWithoutDiscount
            ? `${discountSummary.stationsWithoutDiscount} at retail only`
            : "Max retail vs contract spread"
        }
      />
    </div>
  );
}

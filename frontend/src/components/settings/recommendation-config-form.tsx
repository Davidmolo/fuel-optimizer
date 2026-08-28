"use client";

import Button from "@/components/common/button";
import Card from "@/components/common/card";
import Input from "@/components/common/input";
import Label from "@/components/common/label";
import RecommendationRoutingCostEstimator from "@/components/settings/recommendation-routing-cost-estimator";

export type RecommendationConfigFormValues = {
  corridorBufferMiles: string;
  maxSearchAheadMiles: string;
  maxRoutingLookups: string;
  preFilterDistanceBufferPercent: string;
  defaultTankCapacityGallons: string;
  defaultMpg: string;
  defaultReserveFuelPercent: string;
  maxAlternates: string;
  minAheadOnRouteMiles: string;
  sweetSpotMinPercent: string;
  sweetSpotMaxPercent: string;
};

type RecommendationConfigFormProps = {
  values: RecommendationConfigFormValues;
  loading: boolean;
  onChange: (field: keyof RecommendationConfigFormValues, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-muted">{children}</p>;
}

function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

export default function RecommendationConfigForm({
  values,
  loading,
  onChange,
  onSubmit,
}: RecommendationConfigFormProps) {
  return (
    <Card>
      <div className="mb-6">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Fuel recommendations</h2>
        <p className="mt-1 text-sm text-muted">
          Control how the engine searches stations, limits Google routing calls, and ranks stops.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-8">
        <section className="space-y-5">
          <SectionTitle
            title="Route search"
            description="How far ahead and how wide the corridor search should be."
          />
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="corridorBufferMiles">Corridor width (miles)</Label>
              <Input
                id="corridorBufferMiles"
                type="number"
                min={1}
                max={50}
                value={values.corridorBufferMiles}
                onChange={(e) => onChange("corridorBufferMiles", e.target.value)}
                required
              />
              <FieldHint>Max distance a station can sit off the driving route.</FieldHint>
            </div>
            <div>
              <Label htmlFor="maxSearchAheadMiles">Max search ahead (miles)</Label>
              <Input
                id="maxSearchAheadMiles"
                type="number"
                min={10}
                max={500}
                value={values.maxSearchAheadMiles}
                onChange={(e) => onChange("maxSearchAheadMiles", e.target.value)}
                required
              />
              <FieldHint>Caps search even when the truck has more fuel range left.</FieldHint>
            </div>
            <div>
              <Label htmlFor="minAheadOnRouteMiles">Minimum ahead on route (miles)</Label>
              <Input
                id="minAheadOnRouteMiles"
                type="number"
                min={0}
                max={25}
                value={values.minAheadOnRouteMiles}
                onChange={(e) => onChange("minAheadOnRouteMiles", e.target.value)}
                required
              />
              <FieldHint>Ignore stations behind the truck on the route.</FieldHint>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle
            title="Routing cost control"
            description="Cheap filters run first; Google road distances are only requested for the shortlist."
            action={<RecommendationRoutingCostEstimator maxRoutingLookups={values.maxRoutingLookups} />}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Label htmlFor="maxRoutingLookups">Max Google routing lookups</Label>
              <Input
                id="maxRoutingLookups"
                type="number"
                min={5}
                max={100}
                value={values.maxRoutingLookups}
                onChange={(e) => onChange("maxRoutingLookups", e.target.value)}
                required
              />
              <FieldHint>Maximum stations sent to Google per recommendation.</FieldHint>
            </div>
            <div>
              <Label htmlFor="preFilterDistanceBufferPercent">Pre-filter distance buffer (%)</Label>
              <Input
                id="preFilterDistanceBufferPercent"
                type="number"
                min={0}
                max={50}
                value={values.preFilterDistanceBufferPercent}
                onChange={(e) => onChange("preFilterDistanceBufferPercent", e.target.value)}
                required
              />
              <FieldHint>Extra straight-line buffer before paid road routing.</FieldHint>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle
            title="Fuel range assumptions"
            description="Used when truck tank capacity or MPG is unavailable from fleet data."
          />
          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <Label htmlFor="defaultTankCapacityGallons">Default tank capacity (gal)</Label>
              <Input
                id="defaultTankCapacityGallons"
                type="number"
                min={50}
                max={500}
                value={values.defaultTankCapacityGallons}
                onChange={(e) => onChange("defaultTankCapacityGallons", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="defaultMpg">Default MPG</Label>
              <Input
                id="defaultMpg"
                type="number"
                min={1}
                max={20}
                step="0.1"
                value={values.defaultMpg}
                onChange={(e) => onChange("defaultMpg", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="defaultReserveFuelPercent">Reserve fuel (%)</Label>
              <Input
                id="defaultReserveFuelPercent"
                type="number"
                min={0}
                max={50}
                value={values.defaultReserveFuelPercent}
                onChange={(e) => onChange("defaultReserveFuelPercent", e.target.value)}
                required
              />
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <SectionTitle
            title="Results and ranking"
            description="How many alternates to return and the preferred fueling window along remaining range."
          />
          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <Label htmlFor="maxAlternates">Max alternates</Label>
              <Input
                id="maxAlternates"
                type="number"
                min={0}
                max={5}
                value={values.maxAlternates}
                onChange={(e) => onChange("maxAlternates", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="sweetSpotMinPercent">Sweet spot min (% of range)</Label>
              <Input
                id="sweetSpotMinPercent"
                type="number"
                min={0}
                max={100}
                value={values.sweetSpotMinPercent}
                onChange={(e) => onChange("sweetSpotMinPercent", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="sweetSpotMaxPercent">Sweet spot max (% of range)</Label>
              <Input
                id="sweetSpotMaxPercent"
                type="number"
                min={0}
                max={100}
                value={values.sweetSpotMaxPercent}
                onChange={(e) => onChange("sweetSpotMaxPercent", e.target.value)}
                required
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end border-t border-border pt-5">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save recommendation settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

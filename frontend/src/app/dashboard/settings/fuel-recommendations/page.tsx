"use client";

import { FormEvent, useEffect, useState } from "react";
import Alert from "@/components/common/alert";
import Spinner from "@/components/common/spinner";
import RecommendationConfigForm, {
  type RecommendationConfigFormValues,
} from "@/components/settings/recommendation-config-form";
import { apiRequest } from "@/lib/api";

type RecommendationConfigData = RecommendationConfigFormValues & {
  updatedAt?: string;
};

const defaultValues: RecommendationConfigFormValues = {
  corridorBufferMiles: "15",
  maxSearchAheadMiles: "100",
  maxRoutingLookups: "25",
  preFilterDistanceBufferPercent: "10",
  defaultTankCapacityGallons: "150",
  defaultMpg: "6.5",
  defaultReserveFuelPercent: "15",
  maxAlternates: "2",
  minAheadOnRouteMiles: "1",
  sweetSpotMinPercent: "25",
  sweetSpotMaxPercent: "75",
};

function toFormValues(data: RecommendationConfigData): RecommendationConfigFormValues {
  return {
    corridorBufferMiles: String(data.corridorBufferMiles),
    maxSearchAheadMiles: String(data.maxSearchAheadMiles),
    maxRoutingLookups: String(data.maxRoutingLookups),
    preFilterDistanceBufferPercent: String(data.preFilterDistanceBufferPercent),
    defaultTankCapacityGallons: String(data.defaultTankCapacityGallons),
    defaultMpg: String(data.defaultMpg),
    defaultReserveFuelPercent: String(data.defaultReserveFuelPercent),
    maxAlternates: String(data.maxAlternates),
    minAheadOnRouteMiles: String(data.minAheadOnRouteMiles),
    sweetSpotMinPercent: String(data.sweetSpotMinPercent),
    sweetSpotMaxPercent: String(data.sweetSpotMaxPercent),
  };
}

export default function FuelRecommendationsSettingsPage() {
  const [values, setValues] = useState<RecommendationConfigFormValues>(defaultValues);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      setFetching(true);
      try {
        const result = await apiRequest<RecommendationConfigData>("/api/v1/recommendation-config", {
          method: "GET",
        });

        if (!result.success || !result.data) {
          setIsError(true);
          setMessage(result.message || "Failed to load recommendation settings");
          return;
        }

        setValues(toFormValues(result.data));
      } catch {
        setIsError(true);
        setMessage("Unable to load recommendation settings");
      } finally {
        setFetching(false);
      }
    }

    void loadConfig();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const payload = {
        corridorBufferMiles: Number(values.corridorBufferMiles),
        maxSearchAheadMiles: Number(values.maxSearchAheadMiles),
        maxRoutingLookups: Number(values.maxRoutingLookups),
        preFilterDistanceBufferPercent: Number(values.preFilterDistanceBufferPercent),
        defaultTankCapacityGallons: Number(values.defaultTankCapacityGallons),
        defaultMpg: Number(values.defaultMpg),
        defaultReserveFuelPercent: Number(values.defaultReserveFuelPercent),
        maxAlternates: Number(values.maxAlternates),
        minAheadOnRouteMiles: Number(values.minAheadOnRouteMiles),
        sweetSpotMinPercent: Number(values.sweetSpotMinPercent),
        sweetSpotMaxPercent: Number(values.sweetSpotMaxPercent),
      };

      const result = await apiRequest<RecommendationConfigData>("/api/v1/recommendation-config", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!result.success) {
        setIsError(true);
        setMessage(result.message || "Failed to update recommendation settings");
        return;
      }

      if (result.data) {
        setValues(toFormValues(result.data));
      }

      setMessage("Recommendation settings updated successfully");
    } catch {
      setIsError(true);
      setMessage("Unable to update recommendation settings");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return <Spinner label="Loading recommendation settings..." />;
  }

  return (
    <div className="space-y-3">
      <RecommendationConfigForm
        values={values}
        loading={loading}
        onChange={(field, value) => setValues((prev) => ({ ...prev, [field]: value }))}
        onSubmit={handleSubmit}
      />
      {message ? <Alert variant={isError ? "error" : "success"}>{message}</Alert> : null}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Alert from "@/components/common/alert";
import Spinner from "@/components/common/spinner";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import FleetOverview from "@/components/dashboard/fleet-overview";
import { apiRequest } from "@/lib/api";
import type { FleetListResponse } from "@/types/fleet";

export default function DashboardPage() {
  const [summary, setSummary] = useState<FleetListResponse["summary"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFleetSummary() {
      setLoading(true);
      setError(null);

      try {
        const response = await apiRequest<FleetListResponse>("/api/v1/fleet/vehicles?activeOnly=true");
        if (!response.success || !response.data?.summary) {
          throw new Error(response.message || "Failed to load fleet summary");
        }

        setSummary(response.data.summary);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load fleet summary");
      } finally {
        setLoading(false);
      }
    }

    void loadFleetSummary();
  }, []);

  return (
    <DashboardShell title="Overview" subtitle="Fleet snapshot at a glance">
      {loading ? (
        <Spinner label="Loading fleet summary..." />
      ) : error ? (
        <Alert variant="error">{error}</Alert>
      ) : summary ? (
        <FleetOverview summary={summary} />
      ) : (
        <p className="text-sm text-muted">No fleet data available yet. Sync from the Fleet page.</p>
      )}
    </DashboardShell>
  );
}

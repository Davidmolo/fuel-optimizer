"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@/components/common/alert";
import Button from "@/components/common/button";
import Card from "@/components/common/card";
import Spinner from "@/components/common/spinner";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DriverComplianceReport } from "@/types/reports";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultFromDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 30);
  return toDateInputValue(date);
}

function defaultToDate() {
  return toDateInputValue(new Date());
}

function complianceTone(percent: number) {
  if (percent >= 80) {
    return "text-emerald-700";
  }
  if (percent >= 50) {
    return "text-amber-700";
  }
  return "text-danger";
}

function complianceBadgeClass(percent: number) {
  if (percent >= 80) {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  }
  if (percent >= 50) {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }
  return "bg-danger-muted text-danger ring-danger/20";
}

export default function CompliancePage() {
  const [from, setFrom] = useState(defaultFromDate);
  const [to, setTo] = useState(defaultToDate);
  const [driverFilter, setDriverFilter] = useState("all");
  const [report, setReport] = useState<DriverComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      from: new Date(`${from}T00:00:00.000Z`).toISOString(),
      to: new Date(`${to}T23:59:59.999Z`).toISOString(),
    });

    const response = await apiRequest<DriverComplianceReport>(
      `/api/v1/reports/driver-compliance?${params.toString()}`,
    );

    if (!response.success || !response.data) {
      setReport(null);
      setError(response.message || "Failed to load driver compliance");
      setLoading(false);
      return;
    }

    setReport(response.data);
    setLoading(false);
  }, [from, to]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const driverOptions = useMemo(() => {
    if (!report) {
      return [];
    }

    return report.drivers.map((driver) => ({
      value: driver.driverId === null ? "unassigned" : String(driver.driverId),
      label: driver.driverName,
    }));
  }, [report]);

  const visibleDrivers = useMemo(() => {
    if (!report) {
      return [];
    }

    if (driverFilter === "all") {
      return report.drivers;
    }

    if (driverFilter === "unassigned") {
      return report.drivers.filter((driver) => driver.driverId === null);
    }

    const selectedId = Number.parseInt(driverFilter, 10);
    return report.drivers.filter((driver) => driver.driverId === selectedId);
  }, [driverFilter, report]);

  return (
    <DashboardShell
      title="Driver compliance"
      subtitle="Did drivers arrive at or fuel at the planned stations?"
    >
      <div className="space-y-4">
        <Card compact className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-xs font-medium text-muted">
            From
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
            />
          </label>
          <label className="flex min-w-[10rem] flex-1 flex-col gap-1.5 text-xs font-medium text-muted">
            To
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
            />
          </label>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5 text-xs font-medium text-muted">
            Driver
            <select
              value={driverFilter}
              onChange={(event) => setDriverFilter(event.target.value)}
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
            >
              <option value="all">All drivers</option>
              {driverOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={() => void loadReport()} disabled={loading}>
            Apply
          </Button>
        </Card>

        {loading ? <Spinner label="Loading compliance report..." /> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}

        {!loading && !error && report ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card compact>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Assigned</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {report.totals.assignedStops}
                </p>
              </Card>
              <Card compact>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Followed</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {report.totals.followedStops}
                </p>
              </Card>
              <Card compact>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Missed</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">
                  {report.totals.missedStops}
                </p>
              </Card>
              <Card compact>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Compliance</p>
                <p
                  className={cn(
                    "mt-2 text-2xl font-semibold tabular-nums",
                    complianceTone(report.totals.compliancePercent),
                  )}
                >
                  {report.totals.compliancePercent}%
                </p>
              </Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card compact>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Arrived</p>
                <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                  {report.totals.arrivedStops}
                </p>
                <p className="mt-1 text-xs text-muted">Trimble/CoPilot stop arrival</p>
              </Card>
              <Card compact>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Purchased</p>
                <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                  {report.totals.purchasedStops}
                </p>
                <p className="mt-1 text-xs text-muted">Relay fuel at planned station</p>
              </Card>
              <Card compact>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">GPS near</p>
                <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                  {report.totals.gpsNearStops}
                </p>
                <p className="mt-1 text-xs text-muted">Evidence only — not enough alone</p>
              </Card>
            </div>

            <p className="text-xs text-muted">
              Followed = arrived at the planned stop (Trimble) or fueled there (Relay) within{" "}
              {report.matchWindowDays} days of planning. GPS near is supporting evidence only. Sorted
              worst compliance first.
            </p>

            <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-border bg-surface">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-muted text-xs font-medium tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Driver</th>
                    <th className="px-4 py-3 font-medium">Assigned</th>
                    <th className="px-4 py-3 font-medium">Followed</th>
                    <th className="px-4 py-3 font-medium">Arrived</th>
                    <th className="px-4 py-3 font-medium">Purchased</th>
                    <th className="px-4 py-3 font-medium">GPS near</th>
                    <th className="px-4 py-3 font-medium">Missed</th>
                    <th className="px-4 py-3 font-medium">Compliance</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDrivers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted">
                        No planned fuel stops found for this date range.
                      </td>
                    </tr>
                  ) : (
                    visibleDrivers.map((driver) => (
                      <tr
                        key={driver.driverId === null ? "unassigned" : String(driver.driverId)}
                        className="border-t border-border"
                      >
                        <td className="px-4 py-3 font-medium text-foreground">{driver.driverName}</td>
                        <td className="px-4 py-3 tabular-nums text-muted">{driver.assignedStops}</td>
                        <td className="px-4 py-3 tabular-nums text-muted">{driver.followedStops}</td>
                        <td className="px-4 py-3 tabular-nums text-muted">{driver.arrivedStops}</td>
                        <td className="px-4 py-3 tabular-nums text-muted">{driver.purchasedStops}</td>
                        <td className="px-4 py-3 tabular-nums text-muted">{driver.gpsNearStops}</td>
                        <td className="px-4 py-3 tabular-nums text-muted">{driver.missedStops}</td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset",
                              complianceBadgeClass(driver.compliancePercent),
                            )}
                          >
                            {driver.compliancePercent}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}

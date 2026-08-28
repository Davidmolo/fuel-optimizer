"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import Card from "@/components/common/card";
import Input from "@/components/common/input";
import Label from "@/components/common/label";
import { cn } from "@/lib/utils";

export type TrimbleConnectionStatus = "idle" | "checking" | "connected" | "not_configured" | "failed";

type TrimbleConfigFormValues = {
  apiBaseUrl: string;
  apiKey: string;
};

type TrimbleConfigFormProps = {
  values: TrimbleConfigFormValues;
  loading: boolean;
  testing: boolean;
  hasApiKey: boolean;
  connectionStatus: TrimbleConnectionStatus;
  connectionMessage: string;
  onChange: (field: keyof TrimbleConfigFormValues, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onTestConnection: () => void;
};

const statusStyles: Record<
  Exclude<TrimbleConnectionStatus, "idle" | "checking">,
  { label: string; className: string; dotClassName: string }
> = {
  connected: {
    label: "Connected",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    dotClassName: "bg-emerald-500",
  },
  not_configured: {
    label: "Not configured",
    className: "border-amber-200 bg-amber-50 text-amber-950",
    dotClassName: "bg-amber-500",
  },
  failed: {
    label: "Connection failed",
    className: "border-red-200 bg-red-50 text-red-900",
    dotClassName: "bg-red-500",
  },
};

export default function TrimbleConfigForm({
  values,
  loading,
  testing,
  hasApiKey,
  connectionStatus,
  connectionMessage,
  onChange,
  onSubmit,
  onTestConnection,
}: TrimbleConfigFormProps) {
  const [showKey, setShowKey] = useState(false);
  const statusMeta =
    connectionStatus === "idle" || connectionStatus === "checking"
      ? null
      : statusStyles[connectionStatus];

  return (
    <Card>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">Trimble Maps</h2>
          <p className="mt-1 text-sm text-muted">
            PC*Miler API credentials for truck route paths used in fuel recommendations and trip maps.
          </p>
        </div>

        {connectionStatus === "checking" ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            Checking connection…
          </span>
        ) : statusMeta ? (
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
              statusMeta.className,
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", statusMeta.dotClassName)} />
            {statusMeta.label}
          </span>
        ) : null}
      </div>

      {connectionMessage ? (
        <div
          className={cn(
            "mb-5 rounded-[var(--radius-lg)] border px-3 py-2.5 text-sm",
            connectionStatus === "connected" && "border-emerald-200 bg-emerald-50/80 text-emerald-950",
            connectionStatus === "failed" && "border-red-200 bg-red-50/80 text-red-950",
            connectionStatus === "not_configured" && "border-amber-200 bg-amber-50/80 text-amber-950",
            (connectionStatus === "idle" || connectionStatus === "checking") &&
              "border-border bg-surface-muted text-muted",
          )}
        >
          {connectionMessage}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="apiBaseUrl">API base URL</Label>
            <Input
              id="apiBaseUrl"
              value={values.apiBaseUrl}
              onChange={(e) => onChange("apiBaseUrl", e.target.value)}
              placeholder="https://pcmiler.alk.com/apis/rest/v1.0/Service.svc"
              required
            />
          </div>

          <div>
            <Label htmlFor="apiKey">API key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? "text" : "password"}
                value={values.apiKey}
                onChange={(e) => onChange("apiKey", e.target.value)}
                placeholder={hasApiKey ? "Leave blank to keep current key" : "Enter Trimble API key"}
                className="pr-16"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-muted"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {hasApiKey
                ? "A key is saved. Leave blank to keep it, or enter a new key to replace it."
                : "No key saved yet. Enter your Trimble API key to enable truck routing."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            disabled={loading || testing}
            onClick={onTestConnection}
          >
            {testing ? "Testing…" : "Test connection"}
          </Button>
          <Button type="submit" disabled={loading || testing}>
            {loading ? "Saving..." : "Save Trimble configuration"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

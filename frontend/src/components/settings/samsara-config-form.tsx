"use client";

import { useState } from "react";
import Button from "@/components/common/button";
import Card from "@/components/common/card";
import Input from "@/components/common/input";
import Label from "@/components/common/label";

type SamsaraConfigFormValues = {
  apiBaseUrl: string;
  apiToken: string;
  telemetryStaleMinutes: string;
};

type SamsaraConfigFormProps = {
  values: SamsaraConfigFormValues;
  loading: boolean;
  hasApiToken: boolean;
  onChange: (field: keyof SamsaraConfigFormValues, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export default function SamsaraConfigForm({
  values,
  loading,
  hasApiToken,
  onChange,
  onSubmit,
}: SamsaraConfigFormProps) {
  const [showToken, setShowToken] = useState(false);

  return (
    <Card>
      <div className="mb-6">
        <h2 className="text-base font-semibold tracking-tight text-foreground">Samsara ELD</h2>
        <p className="mt-1 text-sm text-muted">API credentials for GPS and fuel telemetry sync.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="apiBaseUrl">API base URL</Label>
            <Input
              id="apiBaseUrl"
              value={values.apiBaseUrl}
              onChange={(e) => onChange("apiBaseUrl", e.target.value)}
              placeholder="https://api.samsara.com"
              required
            />
          </div>

          <div>
            <Label htmlFor="apiToken">API token</Label>
            <div className="relative">
              <Input
                id="apiToken"
                type={showToken ? "text" : "password"}
                value={values.apiToken}
                onChange={(e) => onChange("apiToken", e.target.value)}
                placeholder={hasApiToken ? "Leave blank to keep current token" : "Enter Samsara API token"}
                className="pr-16"
              />
              <button
                type="button"
                onClick={() => setShowToken((prev) => !prev)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-muted"
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="telemetryStaleMinutes">Telemetry stale threshold (minutes)</Label>
            <Input
              id="telemetryStaleMinutes"
              type="number"
              min={1}
              value={values.telemetryStaleMinutes}
              onChange={(e) => onChange("telemetryStaleMinutes", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-border pt-5">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Samsara configuration"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

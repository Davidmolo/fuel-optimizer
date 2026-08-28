"use client";

import { FormEvent, useEffect, useState } from "react";
import Alert from "@/components/common/alert";
import Spinner from "@/components/common/spinner";
import SamsaraConfigForm from "@/components/settings/samsara-config-form";
import { apiRequest } from "@/lib/api";

type SamsaraConfigData = {
  apiBaseUrl: string;
  telemetryStaleMinutes: number;
  hasApiToken: boolean;
};

export default function SamsaraSettingsPage() {
  const [values, setValues] = useState({
    apiBaseUrl: "",
    apiToken: "",
    telemetryStaleMinutes: "30",
  });
  const [hasApiToken, setHasApiToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      setFetching(true);
      try {
        const result = await apiRequest<SamsaraConfigData>("/api/v1/samsara-config", { method: "GET" });
        if (!result.success || !result.data) {
          setIsError(true);
          setMessage(result.message || "Failed to load Samsara config");
          return;
        }

        setValues({
          apiBaseUrl: result.data.apiBaseUrl,
          apiToken: "",
          telemetryStaleMinutes: String(result.data.telemetryStaleMinutes),
        });
        setHasApiToken(result.data.hasApiToken);
      } catch {
        setIsError(true);
        setMessage("Unable to load Samsara configuration");
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
      const payload: Record<string, string | number> = {
        apiBaseUrl: values.apiBaseUrl,
        telemetryStaleMinutes: Number(values.telemetryStaleMinutes),
      };

      if (values.apiToken.trim()) {
        payload.apiToken = values.apiToken;
      }

      const result = await apiRequest<SamsaraConfigData>("/api/v1/samsara-config", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!result.success) {
        setIsError(true);
        setMessage(result.message || "Failed to update Samsara config");
        return;
      }

      setHasApiToken(result.data?.hasApiToken ?? true);
      setValues((prev) => ({ ...prev, apiToken: "" }));
      setMessage("Samsara configuration updated successfully");
    } catch {
      setIsError(true);
      setMessage("Unable to update Samsara configuration");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return <Spinner label="Loading Samsara configuration..." />;
  }

  return (
    <div className="space-y-3">
      <SamsaraConfigForm
        values={values}
        loading={loading}
        hasApiToken={hasApiToken}
        onChange={(field, value) => setValues((prev) => ({ ...prev, [field]: value }))}
        onSubmit={handleSubmit}
      />
      {message ? <Alert variant={isError ? "error" : "success"}>{message}</Alert> : null}
    </div>
  );
}

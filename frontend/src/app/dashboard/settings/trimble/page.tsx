"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Alert from "@/components/common/alert";
import Spinner from "@/components/common/spinner";
import TrimbleConfigForm, {
  type TrimbleConnectionStatus,
} from "@/components/settings/trimble-config-form";
import { apiRequest } from "@/lib/api";

type TrimbleConfigData = {
  apiBaseUrl: string;
  hasApiKey: boolean;
};

type TrimbleConnectionTestData = {
  ok: boolean;
  status: "connected" | "not_configured" | "failed";
  message: string;
  distanceMiles?: number;
  durationMinutes?: number;
};

const DEFAULT_API_BASE_URL = "https://pcmiler.alk.com/apis/rest/v1.0/Service.svc";

export default function TrimbleSettingsPage() {
  const [values, setValues] = useState({
    apiBaseUrl: DEFAULT_API_BASE_URL,
    apiKey: "",
  });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<TrimbleConnectionStatus>("idle");
  const [connectionMessage, setConnectionMessage] = useState("");

  const runConnectionTest = useCallback(async (options?: { apiBaseUrl?: string; apiKey?: string }) => {
    setTesting(true);
    setConnectionStatus("checking");
    setConnectionMessage("Checking connection to Trimble…");

    try {
      const payload: Record<string, string> = {};
      if (options?.apiBaseUrl?.trim()) {
        payload.apiBaseUrl = options.apiBaseUrl.trim();
      }
      if (options?.apiKey?.trim()) {
        payload.apiKey = options.apiKey.trim();
      }

      const result = await apiRequest<TrimbleConnectionTestData>("/api/v1/trimble-config/test", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = result.data;
      const status = data?.status ?? (result.success ? "connected" : "failed");
      const detail = data?.message || result.message || "Unable to verify Trimble connection";

      setConnectionStatus(status);
      setConnectionMessage(
        status === "connected" && data?.distanceMiles != null
          ? `${detail} Sample route: ${data.distanceMiles} mi / ${data.durationMinutes ?? "—"} min.`
          : detail,
      );
    } catch {
      setConnectionStatus("failed");
      setConnectionMessage("Unable to reach the server to test Trimble.");
    } finally {
      setTesting(false);
    }
  }, []);

  useEffect(() => {
    async function loadConfig() {
      setFetching(true);
      try {
        const result = await apiRequest<TrimbleConfigData>("/api/v1/trimble-config", { method: "GET" });
        if (!result.success || !result.data) {
          setIsError(true);
          setMessage(result.message || "Failed to load Trimble config");
          setConnectionStatus("not_configured");
          setConnectionMessage("Trimble configuration could not be loaded.");
          return;
        }

        setValues({
          apiBaseUrl: result.data.apiBaseUrl || DEFAULT_API_BASE_URL,
          apiKey: "",
        });
        setHasApiKey(result.data.hasApiKey);

        if (result.data.hasApiKey) {
          await runConnectionTest({ apiBaseUrl: result.data.apiBaseUrl });
        } else {
          setConnectionStatus("not_configured");
          setConnectionMessage("No API key saved. Add your Trimble key to enable truck routing.");
        }
      } catch {
        setIsError(true);
        setMessage("Unable to load Trimble configuration");
        setConnectionStatus("failed");
        setConnectionMessage("Unable to load Trimble configuration.");
      } finally {
        setFetching(false);
      }
    }

    void loadConfig();
  }, [runConnectionTest]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const payload: Record<string, string> = {
        apiBaseUrl: values.apiBaseUrl,
      };

      if (values.apiKey.trim()) {
        payload.apiKey = values.apiKey;
      }

      const result = await apiRequest<TrimbleConfigData>("/api/v1/trimble-config", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!result.success) {
        setIsError(true);
        setMessage(result.message || "Failed to update Trimble config");
        return;
      }

      const savedHasKey = result.data?.hasApiKey ?? true;
      setHasApiKey(savedHasKey);
      setValues((prev) => ({ ...prev, apiKey: "" }));
      setMessage("Trimble configuration updated successfully");

      if (savedHasKey) {
        await runConnectionTest({ apiBaseUrl: result.data?.apiBaseUrl || values.apiBaseUrl });
      } else {
        setConnectionStatus("not_configured");
        setConnectionMessage("No API key saved. Add your Trimble key to enable truck routing.");
      }
    } catch {
      setIsError(true);
      setMessage("Unable to update Trimble configuration");
    } finally {
      setLoading(false);
    }
  }

  function handleTestConnection() {
    void runConnectionTest({
      apiBaseUrl: values.apiBaseUrl,
      apiKey: values.apiKey,
    });
  }

  if (fetching) {
    return <Spinner label="Loading Trimble configuration..." />;
  }

  return (
    <div className="space-y-3">
      <TrimbleConfigForm
        values={values}
        loading={loading}
        testing={testing}
        hasApiKey={hasApiKey}
        connectionStatus={connectionStatus}
        connectionMessage={connectionMessage}
        onChange={(field, value) => setValues((prev) => ({ ...prev, [field]: value }))}
        onSubmit={handleSubmit}
        onTestConnection={handleTestConnection}
      />
      {message ? <Alert variant={isError ? "error" : "success"}>{message}</Alert> : null}
    </div>
  );
}

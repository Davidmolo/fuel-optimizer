"use client";

import { FormEvent, useEffect, useState } from "react";
import Alert from "@/components/common/alert";
import Spinner from "@/components/common/spinner";
import EmailConfigForm from "@/components/settings/email-config-form";
import { apiRequest } from "@/lib/api";
import { usePersistedJson } from "@/lib/use-persisted-state";

type MailConfigData = {
  service: string;
  host: string;
  username: string;
  fromName: string;
  hasPassword: boolean;
};

const EMAIL_CONFIG_CACHE_KEY = "fuel_email_config_draft";

const emptyEmailConfigDraft = {
  service: "",
  host: "",
  username: "",
  fromName: "",
  password: "",
};

export default function EmailSettingsPage() {
  const [values, setValues] = usePersistedJson(EMAIL_CONFIG_CACHE_KEY, emptyEmailConfigDraft);
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      setFetching(true);
      try {
        const result = await apiRequest<MailConfigData>("/api/v1/mail-config", { method: "GET" });
        if (!result.success || !result.data) {
          setIsError(true);
          setMessage(result.message || "Failed to load email config");
          return;
        }

        const config = result.data;
        setValues((prev) => ({
          service: prev.service || config.service,
          host: prev.host || config.host,
          username: prev.username || config.username,
          fromName: prev.fromName || config.fromName,
          password: prev.password,
        }));
        setHasPassword(config.hasPassword);
      } catch {
        setIsError(true);
        setMessage("Unable to load email configuration");
      } finally {
        setFetching(false);
      }
    }

    void loadConfig();
  }, [setValues]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const payload: Record<string, string> = {
        service: values.service,
        host: values.host,
        username: values.username,
        fromName: values.fromName,
      };

      if (values.password.trim()) {
        payload.password = values.password;
      }

      const result = await apiRequest<MailConfigData>("/api/v1/mail-config", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!result.success) {
        setIsError(true);
        setMessage(result.message || "Failed to update email config");
        return;
      }

      setHasPassword(result.data?.hasPassword ?? true);
      setValues((prev) => ({ ...prev, password: "" }));
      setMessage("Email configuration updated successfully");
    } catch {
      setIsError(true);
      setMessage("Unable to update email configuration");
    } finally {
      setLoading(false);
    }
  }

  if (fetching) {
    return <Spinner label="Loading email configuration..." />;
  }

  return (
    <div className="space-y-3">
      <EmailConfigForm
        values={values}
        loading={loading}
        hasPassword={hasPassword}
        onChange={(field, value) => setValues((prev) => ({ ...prev, [field]: value }))}
        onSubmit={handleSubmit}
      />
      {message ? <Alert variant={isError ? "error" : "success"}>{message}</Alert> : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Alert from "@/components/common/alert";
import Spinner from "@/components/common/spinner";
import AccountsSettingsPanel from "@/components/settings/accounts-settings-panel";
import { apiRequest } from "@/lib/api";
import type { AccountsWorkspace } from "@/types/account";

export default function AccountsSettingsPage() {
  const [workspace, setWorkspace] = useState<AccountsWorkspace | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadAccounts = useCallback(async (quiet = false) => {
    if (quiet) {
      setLoading(true);
    } else {
      setFetching(true);
    }

    const result = await apiRequest<AccountsWorkspace>("/api/v1/accounts", { method: "GET" });

    if (!result.success || !result.data) {
      setMessage(result.message || "Failed to load accounts");
      setWorkspace(null);
    } else {
      setMessage("");
      setWorkspace(result.data);
    }

    setFetching(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  if (fetching) {
    return <Spinner label="Loading accounts..." />;
  }

  if (!workspace) {
    return <Alert variant="error">{message || "Unable to load accounts."}</Alert>;
  }

  return <AccountsSettingsPanel workspace={workspace} loading={loading} onReload={() => loadAccounts(true)} />;
}

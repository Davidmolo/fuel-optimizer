"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import SettingsTabs from "@/components/settings/settings-tabs";
import { getAuthSession, subscribeAuthSession } from "@/lib/auth-session";

function readAuthRole() {
  return getAuthSession()?.role ?? "";
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const userRole = useSyncExternalStore(subscribeAuthSession, readAuthRole, () => "");
  const canAccessSettings = userRole === "admin";

  useEffect(() => {
    if (userRole && !canAccessSettings) {
      router.replace("/dashboard");
    }
  }, [canAccessSettings, router, userRole]);

  if (userRole && !canAccessSettings) {
    return null;
  }

  return (
    <DashboardShell
      title="Settings"
      subtitle="Manage recommendations, data sync, and workspace accounts"
    >
      <div className="space-y-6">
        <SettingsTabs />
        {children}
      </div>
    </DashboardShell>
  );
}

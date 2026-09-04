"use client";

import DashboardShell from "@/components/dashboard/dashboard-shell";
import SettingsTabs from "@/components/settings/settings-tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
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

"use client";

import DashboardShell from "@/components/dashboard/dashboard-shell";
import SettingsTabs from "@/components/settings/settings-tabs";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell
      title="Settings"
      subtitle="Manage profile, email, recommendation, and data sync settings"
    >
      <div className="space-y-6">
        <SettingsTabs />
        {children}
      </div>
    </DashboardShell>
  );
}

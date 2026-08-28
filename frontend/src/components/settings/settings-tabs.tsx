"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsTabs = [
  { href: "/dashboard/settings/profile", label: "Profile" },
  { href: "/dashboard/settings/email", label: "Email" },
  { href: "/dashboard/settings/fuel-recommendations", label: "Fuel recommendations" },
];

export default function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-border pb-1">
      {settingsTabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-t-[var(--radius-lg)] px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border border-b-0 border-border bg-surface text-primary"
                : "text-muted hover:bg-surface-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

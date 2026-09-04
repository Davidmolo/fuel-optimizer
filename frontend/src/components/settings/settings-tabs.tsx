"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const settingsTabs = [
  { href: "/dashboard/settings/fuel-recommendations", label: "Fuel recommendations" },
  { href: "/dashboard/settings/data-sync", label: "Data sync" },
  { href: "/dashboard/settings/accounts", label: "Accounts" },
];

export default function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border" aria-label="Settings sections">
      {settingsTabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative -mb-px px-4 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-b-2 border-primary text-primary"
                : "border-b-2 border-transparent text-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

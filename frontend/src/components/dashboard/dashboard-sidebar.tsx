"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChevronLeft,
  IconFuel,
  IconLayoutDashboard,
  IconLogOut,
  IconRoute,
  IconSettings,
  IconStation,
  IconTruck,
} from "@/components/common/icons";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

type DashboardSidebarProps = {
  userEmail: string;
  onLogout: () => void;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof IconLayoutDashboard;
  match: (path: string) => boolean;
};

const menuNavItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: IconLayoutDashboard, match: (path: string) => path === "/dashboard" },
  {
    href: "/dashboard/fleet",
    label: "Fleet",
    icon: IconTruck,
    match: (path: string) => path.startsWith("/dashboard/fleet"),
  },
  {
    href: "/dashboard/tms",
    label: "Active loads",
    icon: IconRoute,
    match: (path: string) => path.startsWith("/dashboard/tms"),
  },
  {
    href: "/dashboard/stations",
    label: "Stations",
    icon: IconStation,
    match: (path: string) => path.startsWith("/dashboard/stations"),
  },
];

const otherNavItems: NavItem[] = [
  {
    href: "/dashboard/settings/profile",
    label: "Settings",
    icon: IconSettings,
    match: (path: string) => path.startsWith("/dashboard/settings"),
  },
];

function SidebarNavLink({ item, expanded, pathname }: { item: NavItem; expanded: boolean; pathname: string }) {
  const isActive = item.match(pathname);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={!expanded ? item.label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex items-center rounded-xl text-sm font-medium transition-all duration-150",
        expanded ? "gap-3 px-2 py-1.5" : "justify-center px-0 py-1.5",
        isActive ? "text-sidebar-foreground" : "text-sidebar-muted hover:text-sidebar-foreground",
      )}
    >
      {isActive && expanded ? (
        <span className="absolute inset-0 rounded-xl bg-sidebar-active" aria-hidden="true" />
      ) : null}
      <span
        className={cn(
          "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
          isActive
            ? "bg-primary text-white shadow-[0_6px_16px_rgba(60,80,224,0.35)]"
            : "bg-white/5 text-sidebar-muted group-hover:bg-sidebar-hover group-hover:text-sidebar-foreground",
        )}
      >
        <Icon className="h-[1.125rem] w-[1.125rem]" />
      </span>
      {expanded ? <span className="relative z-10 truncate">{item.label}</span> : null}
    </Link>
  );
}

function emailInitial(email: string) {
  return email.trim().charAt(0).toUpperCase() || "?";
}

export default function DashboardSidebar({ userEmail, onLogout }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebar();
  const [hovering, setHovering] = useState(false);
  const [allowHoverExpand, setAllowHoverExpand] = useState(true);

  const isExpanded = !collapsed || hovering;
  const isOverlay = collapsed && hovering;

  const handleCollapse = () => {
    setCollapsed(true);
    setHovering(false);
    setAllowHoverExpand(false);
  };

  const handleExpand = () => {
    setCollapsed(false);
    setAllowHoverExpand(true);
  };

  return (
    <div
      className={cn(
        "relative h-full shrink-0 transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[var(--sidebar-collapsed-width)]" : "w-[var(--sidebar-width)]",
      )}
    >
      <aside
        className={cn(
          "dashboard-sidebar flex h-full flex-col overflow-hidden rounded-2xl border border-sidebar-border transition-[width] duration-200 ease-in-out",
          isOverlay && "absolute inset-y-0 left-0 z-30 shadow-2xl",
          isExpanded ? "w-[var(--sidebar-width)]" : "w-full",
        )}
        aria-label="Main navigation"
        onMouseEnter={() => {
          if (collapsed && allowHoverExpand) {
            setHovering(true);
          }
        }}
        onMouseLeave={() => {
          setHovering(false);
          setAllowHoverExpand(true);
        }}
      >
        <div
          className={cn(
            "flex h-[var(--dashboard-header-height)] shrink-0 items-center gap-3 px-3",
            !isExpanded && "justify-center px-0",
          )}
        >
          {!isExpanded ? (
            <button
              type="button"
              onClick={handleExpand}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-white shadow-[0_8px_18px_rgba(60,80,224,0.35)] transition hover:brightness-110"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <IconFuel className="h-5 w-5" />
            </button>
          ) : (
            <>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-white shadow-[0_8px_18px_rgba(60,80,224,0.35)]">
                <IconFuel className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-semibold tracking-tight text-sidebar-foreground">
                  Fuel Optimizer
                </p>
                <p className="truncate text-[0.6875rem] text-sidebar-muted">Distribution System</p>
              </div>
              <button
                type="button"
                onClick={handleCollapse}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-muted transition hover:bg-sidebar-hover hover:text-sidebar-foreground"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <IconChevronLeft className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <nav className={cn("min-h-0 flex-1 overflow-y-auto py-3", isExpanded ? "px-3" : "px-2")}>
          {isExpanded ? (
            <p className="mb-2 px-2 text-[0.625rem] font-semibold tracking-[0.14em] text-sidebar-muted uppercase">
              Workspace
            </p>
          ) : null}

          <div className="space-y-1">
            {menuNavItems.map((item) => (
              <SidebarNavLink key={item.href} item={item} expanded={isExpanded} pathname={pathname} />
            ))}
          </div>

          {isExpanded ? (
            <p className="mt-6 mb-2 px-2 text-[0.625rem] font-semibold tracking-[0.14em] text-sidebar-muted uppercase">
              System
            </p>
          ) : (
            <div className="mt-3" />
          )}

          <div className="space-y-1">
            {otherNavItems.map((item) => (
              <SidebarNavLink key={item.href} item={item} expanded={isExpanded} pathname={pathname} />
            ))}
          </div>
        </nav>

        <div className={cn("mt-auto shrink-0 border-t border-sidebar-border", isExpanded ? "p-3" : "p-2")}>
          {isExpanded ? (
            <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/5 px-2.5 py-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-sidebar-foreground">
                {emailInitial(userEmail)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground" title={userEmail}>
                  {userEmail}
                </p>
                <p className="text-[0.6875rem] text-sidebar-muted">Signed in</p>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onLogout}
            title={!isExpanded ? "Logout" : undefined}
            className={cn(
              "flex items-center rounded-xl text-sm font-medium text-sidebar-muted transition hover:bg-white/5 hover:text-sidebar-foreground",
              isExpanded ? "h-10 w-full gap-2.5 px-3" : "h-10 w-full justify-center",
            )}
          >
            <IconLogOut className="h-4 w-4" />
            {isExpanded ? <span>Logout</span> : null}
          </button>
        </div>
      </aside>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Spinner from "@/components/common/spinner";
import { IconChevronDown, IconLogOut, IconPanelLeft, IconSettings } from "@/components/common/icons";
import { clearAuthSession, getAuthSession, subscribeAuthSession } from "@/lib/auth-session";
import { useClientMounted } from "@/lib/use-client-mounted";
import { cn } from "@/lib/utils";
import DashboardSidebar from "./dashboard-sidebar";
import { useSidebar } from "./sidebar-context";

type DashboardShellProps = {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  fill?: boolean;
};

function readAuthEmail() {
  return getAuthSession()?.email ?? "";
}

function emailInitial(email: string) {
  return email.trim().charAt(0).toUpperCase() || "?";
}

function emailDisplayName(email: string) {
  const local = email.split("@")[0]?.trim();
  return local || email;
}

function UserMenu({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex max-w-[16rem] items-center gap-2.5 rounded-full border border-border bg-surface py-1 pr-2 pl-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition",
          "hover:border-primary/25 hover:bg-primary-muted/40",
          open && "border-primary/30 bg-primary-muted/50",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-hover text-xs font-semibold text-white">
          {emailInitial(email)}
        </span>
        <span className="hidden min-w-0 text-left sm:block">
          <span className="block truncate text-[0.8125rem] leading-tight font-semibold text-foreground">
            {emailDisplayName(email)}
          </span>
          <span className="block truncate text-[0.6875rem] leading-tight text-muted">{email}</span>
        </span>
        <IconChevronDown
          className={cn("hidden h-3.5 w-3.5 text-muted transition-transform sm:block", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
        >
          <Link
            href="/dashboard/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted"
          >
            <IconSettings className="h-4 w-4 text-muted" />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted"
          >
            <IconLogOut className="h-4 w-4 text-muted" />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function DashboardShell({ children, title, subtitle, fill = false }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const mounted = useClientMounted();
  const userEmail = useSyncExternalStore(subscribeAuthSession, readAuthEmail, () => "");
  const { collapsed, toggle } = useSidebar();

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (!getAuthSession()) {
      router.replace("/");
    }
  }, [mounted, pathname, router]);

  function handleLogout() {
    clearAuthSession();
    router.replace("/");
  }

  if (!mounted || !userEmail) {
    return (
      <div className="app-shell flex h-dvh items-center justify-center">
        <Spinner label="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="app-shell flex h-dvh w-full gap-3 overflow-hidden p-2.5 sm:p-3">
      <DashboardSidebar userEmail={userEmail} onLogout={handleLogout} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <header className="dashboard-chrome-header">
          <button
            type="button"
            onClick={toggle}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-nav transition hover:border-primary/20 hover:bg-primary-muted hover:text-primary"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <IconPanelLeft className="h-[1.125rem] w-[1.125rem]" />
          </button>

          <span className="hidden h-7 w-px shrink-0 bg-border sm:block" aria-hidden="true" />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.0625rem] leading-tight font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle ? <p className="truncate text-[0.8125rem] leading-tight text-muted">{subtitle}</p> : null}
          </div>

          <UserMenu email={userEmail} onLogout={handleLogout} />
        </header>

        <main
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-x-hidden",
            fill
              ? "flex flex-col overflow-y-auto px-3 py-3 lg:overflow-hidden"
              : "overflow-y-auto px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import { createContext, useContext } from "react";
import { usePersistedBoolean } from "@/lib/use-persisted-state";
import { useClientMounted } from "@/lib/use-client-mounted";

const SIDEBAR_COLLAPSED_KEY = "fuel_sidebar_collapsed";

type SidebarContextValue = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const mounted = useClientMounted();
  const [collapsed, setCollapsed] = usePersistedBoolean(SIDEBAR_COLLAPSED_KEY, false);
  const toggle = () => setCollapsed((prev) => !prev);

  return (
    <SidebarContext.Provider
      value={{
        collapsed: mounted ? collapsed : false,
        toggle,
        setCollapsed,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}

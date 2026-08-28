"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "@/store";

type StoreProviderProps = {
  children: React.ReactNode;
};

export default function StoreProvider({ children }: StoreProviderProps) {
  const [store] = useState<AppStore>(makeStore);
  return <Provider store={store}>{children}</Provider>;
}

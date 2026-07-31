"use client";

import { create } from "zustand";

interface UiState {
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  aiOpen: boolean;
  notificationsOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
  setCommandOpen: (value: boolean) => void;
  setAiOpen: (value: boolean) => void;
  setNotificationsOpen: (value: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  commandOpen: false,
  aiOpen: false,
  notificationsOpen: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
  setCommandOpen: (value) => set({ commandOpen: value }),
  setAiOpen: (value) => set({ aiOpen: value }),
  setNotificationsOpen: (value) => set({ notificationsOpen: value }),
}));

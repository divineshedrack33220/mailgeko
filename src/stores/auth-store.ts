"use client";

import { create } from "zustand";

interface AuthState {
  user: {
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
  } | null;
  isAuthenticated: boolean;
  login: (email: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    name: "Grace Lee",
    email: "grace@mailgeko.dev",
    role: "Owner",
  },
  isAuthenticated: true,
  login: (email) =>
    set({
      user: { name: "Grace Lee", email, role: "Owner" },
      isAuthenticated: true,
    }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));

"use client";

import { create } from "zustand";

import { api, getToken, setToken } from "@/lib/api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
  workspaceID: string;
}

interface AuthState {
  user: AuthUser | null;
  workspaceID: string | null;
  isAuthenticated: boolean;
  boot: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  workspaceID: null,
  isAuthenticated: false,

  boot: async () => {
    if (!getToken()) {
      set({ user: null, workspaceID: null, isAuthenticated: false });
      return;
    }
    try {
      const res = await api.get<{ user: AuthUser; workspaceID: string }>("/api/v1/me");
      set({
        user: res.user,
        workspaceID: res.workspaceID,
        isAuthenticated: true,
      });
    } catch {
      setToken(null);
      set({ user: null, workspaceID: null, isAuthenticated: false });
    }
  },

  login: async (email, password) => {
    const res = await api.post<AuthResponse>("/api/v1/auth/login", { email, password });
    setToken(res.token);
    set({
      user: res.user,
      workspaceID: res.workspaceID,
      isAuthenticated: true,
    });
  },

  register: async (name, email, password) => {
    const res = await api.post<AuthResponse>("/api/v1/auth/register", { name, email, password });
    setToken(res.token);
    set({
      user: res.user,
      workspaceID: res.workspaceID,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    try {
      await api.post("/api/v1/auth/logout");
    } catch {
      // token is cleared regardless
    }
    setToken(null);
    set({ user: null, workspaceID: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user }),
}));

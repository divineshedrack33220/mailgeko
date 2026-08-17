"use client";

import { create } from "zustand";

import { api, ApiError } from "@/lib/api";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
  workspaceID: string;
  role?: string;
}

interface SwitchWorkspaceResponse {
  token?: string;
  user?: AuthUser;
  workspaceID: string;
  role?: string;
}

interface AuthState {
  user: AuthUser | null;
  workspaceID: string | null;
  role: string | null;
  isAuthenticated: boolean;
  boot: () => Promise<void>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<string | null>;
  verifyTwoFactor: (pendingToken: string, code: string) => Promise<void>;
  register: (name: string, email: string, password?: string) => Promise<boolean>;
  acceptInvite: (token: string) => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  workspaceID: null,
  role: null,
  isAuthenticated: false,

  boot: async () => {
    // The session is now carried by an httpOnly cookie. Always attempt to
    // fetch /me — the browser sends the cookie automatically. A 401/403
    // means the session is invalid.
    try {
      const res = await api.get<{ user: AuthUser; workspaceID: string; role?: string }>("/api/v1/me");
      set({
        user: res.user,
        workspaceID: res.workspaceID,
        role: res.role ?? null,
        isAuthenticated: true,
      });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        set({ user: null, workspaceID: null, role: null, isAuthenticated: false });
        return;
      }
      set({ isAuthenticated: false });
    }
  },

  login: async (email, password, rememberMe = true) => {
    const res = await api.post<
      | (AuthResponse & { requiresTwoFactor?: never })
      | { requiresTwoFactor: true; pendingToken: string }
    >("/api/v1/auth/login", { email, password, rememberMe });
    if ("requiresTwoFactor" in res && res.requiresTwoFactor) {
      return res.pendingToken;
    }
    // The session cookie is set by the backend via Set-Cookie header.
    set({
      user: res.user,
      workspaceID: res.workspaceID,
      role: res.role ?? null,
      isAuthenticated: true,
    });
    return null;
  },

  verifyTwoFactor: async (pendingToken, code) => {
    const res = await api.post<AuthResponse>("/api/v1/auth/2fa/verify", {
      pendingToken,
      code,
    });
    set({
      user: res.user,
      workspaceID: res.workspaceID,
      role: res.role ?? null,
      isAuthenticated: true,
    });
  },

  register: async (name, email, password) => {
    // When no password is provided the backend returns a message instead of a
    // session — the user must verify their email and set a password first.
    const res = await api.post<
      AuthResponse | { message: string }
    >("/api/v1/auth/register", { name, email, ...(password ? { password } : {}) });
    if ("token" in res && res.token) {
      set({
        user: res.user,
        workspaceID: res.workspaceID,
        role: res.role ?? null,
        isAuthenticated: true,
      });
      return true;
    }
    return false;
  },

  acceptInvite: async (token) => {
    const res = await api.post<AuthResponse>("/api/v1/invitations/accept", { token });
    set({
      user: res.user,
      workspaceID: res.workspaceID,
      role: res.role ?? null,
      isAuthenticated: true,
    });
  },

  switchWorkspace: async (workspaceId) => {
    const res = await api.post<SwitchWorkspaceResponse>("/api/v1/workspace/switch", {
      workspaceId,
    });
    set({
      user: res.user ?? get().user,
      workspaceID: res.workspaceID,
      role: res.role ?? get().role,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    try {
      await api.post("/api/v1/auth/logout");
    } catch {
      // The server clears the session cookie regardless.
    }
    set({ user: null, workspaceID: null, role: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user }),
}));

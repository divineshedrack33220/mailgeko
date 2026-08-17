import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      upload: vi.fn(),
    },
  };
});

import { api } from "@/lib/api";

const apiGetMock = vi.mocked(api.get);

const resetStore = () =>
  useAuthStore.setState({
    user: null,
    workspaceID: null,
    role: null,
    isAuthenticated: false,
  });

beforeEach(() => {
  resetStore();
  apiGetMock.mockReset();
});

describe("auth store boot", () => {
  it("restores the session when /me succeeds (cookie-based)", async () => {
    apiGetMock.mockResolvedValue({
      user: { id: "u1", name: "Ada", email: "ada@example.com", role: "owner" },
      workspaceID: "w1",
      role: "owner",
    });

    await useAuthStore.getState().boot();

    expect(apiGetMock).toHaveBeenCalledWith("/api/v1/me");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe("ada@example.com");
  });

  it("clears the session when the session is rejected (401)", async () => {
    apiGetMock.mockRejectedValue(new ApiError(401, "unauthorized", "session expired"));

    await useAuthStore.getState().boot();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("keeps the session on a transient network failure", async () => {
    apiGetMock.mockRejectedValue(new ApiError(0, "network", "could not reach the API server"));

    await useAuthStore.getState().boot();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

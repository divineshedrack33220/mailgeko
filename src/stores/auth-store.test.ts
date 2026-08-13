import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, getToken, setToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getToken: vi.fn(),
    setToken: vi.fn(),
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

const getTokenMock = vi.mocked(getToken);
const setTokenMock = vi.mocked(setToken);
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
  getTokenMock.mockReset();
  setTokenMock.mockReset();
  apiGetMock.mockReset();
});

describe("auth store boot", () => {
  it("stays signed out when no token is stored", async () => {
    getTokenMock.mockReturnValue(null);
    await useAuthStore.getState().boot();

    expect(apiGetMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("restores the session when /me succeeds", async () => {
    getTokenMock.mockReturnValue("tok");
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

  it("clears the token when the session is rejected (401)", async () => {
    getTokenMock.mockReturnValue("tok");
    apiGetMock.mockRejectedValue(new ApiError(401, "unauthorized", "session expired"));

    await useAuthStore.getState().boot();

    expect(setTokenMock).toHaveBeenCalledWith(null);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("keeps the token on a transient network failure", async () => {
    getTokenMock.mockReturnValue("tok");
    apiGetMock.mockRejectedValue(new ApiError(0, "network", "could not reach the API server"));

    await useAuthStore.getState().boot();

    expect(setTokenMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

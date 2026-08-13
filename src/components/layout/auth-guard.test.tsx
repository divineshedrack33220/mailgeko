import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGuard } from "@/components/layout/auth-guard";
import { useAuthStore } from "@/stores/auth-store";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  __esModule: true,
  ApiError: class ApiError extends Error {},
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
}));

import { api, getToken } from "@/lib/api";
import { useRouter } from "next/navigation";

const routerReplace = vi.fn();
const useRouterMock = vi.mocked(useRouter);

const meResponse = {
  user: { id: "u1", name: "Ada", email: "ada@example.com", role: "owner" },
  workspaceID: "w1",
  role: "owner",
};

beforeEach(() => {
  useRouterMock.mockReturnValue({ replace: routerReplace } as never);
  useAuthStore.setState({
    user: null,
    workspaceID: null,
    role: null,
    isAuthenticated: false,
  });
  routerReplace.mockReset();
  vi.mocked(getToken).mockReset();
  vi.mocked(api.get).mockReset();
});

describe("AuthGuard", () => {
  it("renders children once booted as authenticated", async () => {
    // A signed-in session: a token exists and /me succeeds.
    vi.mocked(getToken).mockReturnValue("tok");
    vi.mocked(api.get).mockResolvedValue(meResponse as never);

    render(
      <AuthGuard>
        <p>Dashboard content</p>
      </AuthGuard>,
    );

    await waitFor(() => expect(screen.getByText("Dashboard content")).toBeInTheDocument());
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("redirects to /login when boot finishes signed out", async () => {
    // No token in storage, so boot() resolves unauthenticated without network.
    vi.mocked(getToken).mockReturnValue(null);

    render(
      <AuthGuard>
        <p>Dashboard content</p>
      </AuthGuard>,
    );

    await waitFor(() => expect(routerReplace).toHaveBeenCalled());

    expect(routerReplace).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("Dashboard content")).not.toBeInTheDocument();
  });
});

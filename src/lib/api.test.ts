import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, getToken, setToken } from "@/lib/api";

const fetchMock = vi.fn();
const replaceMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  window.localStorage.clear();
  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      ...window.location,
      pathname: "/campaigns",
      search: "",
      replace: replaceMock,
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  replaceMock.mockReset();
});

describe("token storage", () => {
  it("returns null when no token is stored", () => {
    expect(getToken()).toBeNull();
  });

  it("stores and returns a token", () => {
    setToken("abc");
    expect(getToken()).toBe("abc");
  });

  it("clears the token when null is passed", () => {
    setToken("abc");
    setToken(null);
    expect(getToken()).toBeNull();
  });
});

describe("api client", () => {
  it("sends the bearer token on authenticated requests", async () => {
    setToken("tok-123");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await api.get("/api/v1/me");

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/me");
    expect(new Headers(opts.headers).get("Authorization")).toBe("Bearer tok-123");
  });

  it("omits the Authorization header when no token is stored", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await api.get("/api/v1/me");

    const [, opts] = fetchMock.mock.calls[0];
    expect(new Headers(opts.headers).has("Authorization")).toBe(false);
  });

  it("serializes JSON bodies on POST", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await api.post("/api/v1/auth/password", { currentPassword: "x" });

    const [, opts] = fetchMock.mock.calls[0];
    expect(new Headers(opts.headers).get("Content-Type")).toContain("application/json");
    expect(JSON.parse(String(opts.body))).toEqual({ currentPassword: "x" });
  });

  it("throws a typed ApiError with server message and code", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ error: "not_found", message: "Campaign missing" }),
    });

    const err = (await api.get("/api/v1/campaigns/42").catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.code).toBe("not_found");
    expect(err.message).toBe("Campaign missing");
  });

  it("surfaces network failures as status-0 errors", async () => {
    fetchMock.mockRejectedValue(new TypeError("failed to fetch"));

    const err = (await api.get("/api/v1/me").catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.code).toBe("network");
  });

  it("returns undefined for 204 responses", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });

    const res = await api.delete("/api/v1/contacts/42");
    expect(res).toBeUndefined();
  });
});

describe("401 interceptor", () => {
  it("redirects to login and clears the token on an expired session", async () => {
    setToken("expired");
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: "unauthorized", message: "invalid or expired token" }),
    });

    await api.get("/api/v1/me").catch(() => {});

    // The current path is preserved for a post-login redirect.
    expect(replaceMock).toHaveBeenCalledWith("/login?next=%2Fcampaigns");
    expect(getToken()).toBeNull();
  });

  it("does not redirect for auth endpoints that legitimately return 401", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ error: "invalid_credentials", message: "Bad credentials" }),
    });

    await api.post("/api/v1/auth/login", { email: "a@b.c", password: "x" }).catch(() => {});

    expect(replaceMock).not.toHaveBeenCalled();
  });
});

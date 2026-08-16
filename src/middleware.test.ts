import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clientIp } from "@/middleware";

function req(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/v1/x", { headers });
}

describe("clientIp", () => {
  beforeEach(() => {
    delete process.env.TRUSTED_PROXY_IPS;
  });
  afterEach(() => {
    delete process.env.TRUSTED_PROXY_IPS;
  });

  it("falls back to 0.0.0.0 when no identity headers are present", () => {
    expect(clientIp(req({}))).toBe("0.0.0.0");
  });

  it("takes the rightmost X-Forwarded-For hop when it is untrusted", () => {
    expect(clientIp(req({ "x-forwarded-for": "198.51.100.9, 203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("skips trusted-proxy hops from the right", () => {
    const cidrs = ["10.0.0.0/8", "127.0.0.1/32"];
    expect(clientIp(req({ "x-forwarded-for": "1.1.1.1, 10.0.0.5, 10.0.0.6" }), cidrs)).toBe("1.1.1.1");
  });

  it("does not let a spoofed loopback hop claim trusted status", () => {
    const cidrs = ["127.0.0.1/32"];
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 127.0.0.1" }), cidrs)).toBe("6.6.6.6");
  });

  it("falls back to the leftmost hop when every hop is trusted", () => {
    const cidrs = ["10.0.0.0/8", "127.0.0.1/32"];
    expect(clientIp(req({ "x-forwarded-for": "127.0.0.1, 10.0.0.2" }), cidrs)).toBe("127.0.0.1");
  });

  it("ignores garbage hops", () => {
    expect(clientIp(req({ "x-forwarded-for": "not-an-ip, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls through to x-real-ip when the forwarded chain is all garbage", () => {
    expect(clientIp(req({ "x-forwarded-for": "not-an-ip", "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("honours x-real-ip when X-Forwarded-For is absent", () => {
    expect(clientIp(req({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("rejects an invalid x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "999.1.1.1" }))).toBe("0.0.0.0");
  });

  it("honours TRUSTED_PROXY_IPS from the environment", () => {
    process.env.TRUSTED_PROXY_IPS = "10.1.0.0/16";
    expect(clientIp(req({ "x-forwarded-for": "198.51.100.9, 10.1.2.3" }))).toBe("198.51.100.9");
  });

  it("handles IPv6 hops and IPv4-mapped addresses", () => {
    expect(clientIp(req({ "x-forwarded-for": "2001:db8::1, ::ffff:203.0.113.7" }))).toBe("::ffff:203.0.113.7");
  });

  it("skips trusted IPv6 hops", () => {
    const cidrs = ["::1/128", "2001:db8::/32"];
    expect(clientIp(req({ "x-forwarded-for": "198.51.100.9, 2001:db8::5, ::1" }), cidrs)).toBe("198.51.100.9");
  });
});

import { describe, expect, it } from "vitest";

import {
  clampPercent,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  greetingForTime,
  initials,
  timeAgo,
} from "./format";

describe("formatNumber", () => {
  it("formats integers with thousands separators", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
  it("formats decimals", () => {
    expect(formatNumber(1234.5)).toBe("1,234.5");
  });
  it("formats compact notation", () => {
    expect(formatNumber(1500, true)).toBe("1.5K");
    expect(formatNumber(1200000, true)).toBe("1.2M");
  });
});

describe("formatPercent", () => {
  it("appends a percent sign with one decimal by default", () => {
    expect(formatPercent(33.33333)).toBe("33.3%");
  });
  it("respects the digits option", () => {
    expect(formatPercent(33.33333, 2)).toBe("33.33%");
  });
  it("handles zero", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });
});

describe("initials", () => {
  it("returns the uppercase initials", () => {
    expect(initials("ada", "lovelace")).toBe("AL");
  });
  it("handles a single name", () => {
    expect(initials("ada", "")).toBe("A");
    expect(initials("", "lovelace")).toBe("L");
  });
  it("falls back when both are empty", () => {
    expect(initials("", "")).toBe("?");
    expect(initials("", "", "X")).toBe("X");
  });
});

describe("clampPercent", () => {
  it("clamps to 0 for negatives", () => {
    expect(clampPercent(-5)).toBe(0);
  });
  it("clamps to 100 for overflows", () => {
    expect(clampPercent(150)).toBe(100);
  });
  it("passes through in-range values", () => {
    expect(clampPercent(42)).toBe(42);
  });
});

describe("greetingForTime", () => {
  it("morning 5-11", () => {
    expect(greetingForTime(new Date("2024-01-01T07:00:00"))).toBe("Good morning");
  });
  it("afternoon 12-16", () => {
    expect(greetingForTime(new Date("2024-01-01T14:00:00"))).toBe("Good afternoon");
  });
  it("evening 17-21", () => {
    expect(greetingForTime(new Date("2024-01-01T19:00:00"))).toBe("Good evening");
  });
  it("night 22-4", () => {
    expect(greetingForTime(new Date("2024-01-01T02:00:00"))).toBe("Good night");
  });
});

describe("formatDate / formatDateTime", () => {
  const d = new Date("2024-03-07T09:05:00");
  it("formats a date", () => {
    expect(formatDate(d)).toBe("Mar 7, 2024");
  });
  it("formats a date+time", () => {
    expect(formatDateTime(d)).toBe("Mar 7, 2024 9:05 AM");
  });
  it("accepts an ISO string", () => {
    expect(formatDate("2024-03-07")).toBe("Mar 7, 2024");
  });
});

describe("timeAgo", () => {
  it("reports a recent past time", () => {
    const recent = new Date(Date.now() - 30_000);
    expect(timeAgo(recent)).toMatch(/ago$/);
  });
});

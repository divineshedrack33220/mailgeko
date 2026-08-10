import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandingNavCTA } from "./landing-nav-cta";

describe("LandingNavCTA", () => {
  it("shows 'Go to dashboard' when the visitor is authenticated", () => {
    render(<LandingNavCTA visitorName="ADA" />);
    const link = screen.getByRole("link", { name: "Go to dashboard" });
    expect(link).toHaveAttribute("href", "/dashboard");
    // Public-only CTAs must not appear for an authenticated visitor.
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Get Started" })).toBeNull();
  });

  it("shows Sign in + Get Started when the visitor is anonymous", () => {
    render(<LandingNavCTA visitorName={null} />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(screen.getByRole("link", { name: "Get Started" })).toHaveAttribute(
      "href",
      "/register"
    );
  });
});

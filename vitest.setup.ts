import "@testing-library/jest-dom";
import React from "react";
import type { ImageProps } from "next/image";
import { vi } from "vitest";

// next/image renders an optimized <img>; in tests it's a plain img element so
// src/alt assertions work under happy-dom without the next optimizer.
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: ImageProps) => {
    const { src, ...rest } = props;
    const imgProps = { ...rest, src: String(src ?? "") } as React.ImgHTMLAttributes<HTMLImageElement>;
    return React.createElement("img", imgProps);
  },
}));

// next/font returns class names; stub to a no-op so className-based markup
// renders without the font pipeline.
vi.mock("next/font/google", () => ({
  __esModule: true,
  Archivo: () => ({ variable: "", className: "font-archivo" }),
  JetBrains_Mono: () => ({ variable: "", className: "font-mono" }),
  Inter: () => ({ variable: "", className: "font-inter" }),
  Space_Grotesk: () => ({ variable: "", className: "font-sans" }),
}));

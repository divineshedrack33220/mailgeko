"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const MIN_SCALE = 0.5;
const DESKTOP_ZOOM = 1.15;

export function FitZoom({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const boxRef = React.useRef<HTMLDivElement>(null);
  const outerRef = React.useRef<HTMLDivElement>(null);
  const anchorRef = React.useRef<{ x: number; y: number } | null>(null);
  const fitRef = React.useRef({ s: 1, x: 0, y: 0 });
  const [tf, setTf] = React.useState({ s: 1, x: 0, y: 0 });
  const tfRef = React.useRef(tf);
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    tfRef.current = tf;
  }, [tf]);

  const canZoom = React.useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const applyFit = React.useCallback(() => {
    const box = boxRef.current;
    const outer = outerRef.current;
    if (!box || !outer) return;
    const avail = box.clientHeight;
    const natural = outer.offsetHeight;
    const width = outer.offsetWidth;
    const s = natural <= avail ? 1 : Math.max(MIN_SCALE, avail / natural);
    const x = (width * (1 - s)) / 2;
    const y = Math.max(0, (avail - s * natural) / 2);
    fitRef.current = { s, x, y };
    if (anchorRef.current) {
      const a = anchorRef.current;
      const sFocus = s < 1 ? 1 : DESKTOP_ZOOM;
      setTf({ s: sFocus, x: x - (sFocus - s) * a.x, y: y - (sFocus - s) * a.y });
    } else {
      setTf({ s, x, y });
    }
  }, []);

  React.useLayoutEffect(() => {
    applyFit();
    const box = boxRef.current;
    const outer = outerRef.current;
    if (!box || !outer) return;
    const ro = new ResizeObserver(applyFit);
    ro.observe(box);
    ro.observe(outer);
    window.addEventListener("resize", applyFit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", applyFit);
    };
  }, [applyFit]);

  React.useEffect(() => {
    if (!focused) return;
    const reset = () => {
      anchorRef.current = null;
      setFocused(false);
      setTf(fitRef.current);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") reset();
    };
    window.addEventListener("scroll", reset, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", reset, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [focused]);

  const handleFocus = React.useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (!canZoom) return;
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return;
      const outer = outerRef.current;
      if (!outer) return;
      const cur = tfRef.current;
      const wr = outer.getBoundingClientRect();
      const fr = target.getBoundingClientRect();
      const a = {
        x: (fr.left + fr.width / 2 - wr.left) / cur.s,
        y: (fr.top + fr.height / 2 - wr.top) / cur.s,
      };
      anchorRef.current = a;
      setFocused(true);
      const sNew = fitRef.current.s < 1 ? 1 : DESKTOP_ZOOM;
      setTf({
        s: sNew,
        x: cur.x + (cur.s - sNew) * a.x,
        y: cur.y + (cur.s - sNew) * a.y,
      });
    },
    [canZoom]
  );

  const handleBlur = React.useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    anchorRef.current = null;
    setFocused(false);
    setTf(fitRef.current);
  }, []);

  return (
    <div ref={boxRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={outerRef}
        onFocusCapture={handleFocus}
        onBlurCapture={handleBlur}
        className={cn(
          "mx-auto w-full max-w-sm transition-all duration-300 ease-out",
          focused ? "shadow-xl will-change-transform" : undefined,
          className
        )}
        style={{
          transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.s})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>
    </div>
  );
}

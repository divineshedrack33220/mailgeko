"use client";

import * as React from "react";

export function useShake() {
  const [shaking, setShaking] = React.useState(false);

  const trigger = React.useCallback(() => setShaking(true), []);
  const onAnimationEnd = React.useCallback(() => setShaking(false), []);

  return {
    className: shaking ? "animate-shake" : undefined,
    trigger,
    onAnimationEnd,
  };
}

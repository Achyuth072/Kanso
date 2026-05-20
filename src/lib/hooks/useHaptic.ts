"use client";

import { useCallback } from "react";
import { useUiStore } from "@/lib/store/uiStore";
import { useMediaQuery } from "./useMediaQuery";

export type HapticSignature = "tick" | "toggle" | "thud" | "success";

const SIGNATURES: Record<HapticSignature, number | number[]> = {
  tick: 10,
  toggle: 15,
  thud: 50,
  success: [10, 50],
};

export function useHaptic() {
  const hapticsEnabled = useUiStore((state) => state.hapticsEnabled);
  const isPhone = useMediaQuery(
    "(max-width: 640px) or ((hover: none) and (pointer: coarse))",
  );

  const trigger = useCallback(
    (signature: HapticSignature = "tick") => {
      if (
        hapticsEnabled &&
        isPhone &&
        typeof navigator !== "undefined" &&
        navigator.vibrate
      ) {
        const vibrationPattern = SIGNATURES[signature];
        navigator.vibrate(vibrationPattern);
      }
    },
    [hapticsEnabled, isPhone],
  );

  return {
    trigger,
    isPhone,
    hapticsEnabled,
  };
}

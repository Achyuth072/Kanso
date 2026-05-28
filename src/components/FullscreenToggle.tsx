"use client";

import { motion } from "framer-motion";
import { Maximize2, Minimize2 } from "lucide-react";
import { useFullscreen } from "@/lib/hooks/useFullscreen";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Fullscreen Toggle Button
 *
 * Ghost icon button (h-14 w-14 rounded-full) positioned absolute top-right
 * of the focus page. Toggles between fullscreen enter/exit states.
 *
 * - Maximize2 icon when not fullscreen
 * - Minimize2 icon when fullscreen (text-brand active color)
 * - Haptic: toggle on tap
 * - ARIA labels for accessibility
 *
 * Bordered to differentiate from the borderless ghost PiP button — both
 * share the round h-14 w-14 silhouette. The border is subtle (border/40
 * by default, brand/40 when fullscreen) and adapts to light/dark theme.
 */

export function FullscreenToggle() {
  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreen();
  const { trigger } = useHaptic();

  const handleClick = () => {
    trigger("toggle");
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      whileTap={{ scale: 0.95 }}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "absolute top-4 right-4 h-14 w-14 rounded-full active:scale-95 transition-seijaku cursor-pointer",
      )}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
    >
      {isFullscreen ? (
        <Minimize2 className="h-6 w-6" strokeWidth={2.25} />
      ) : (
        <Maximize2 className="h-6 w-6" strokeWidth={2.25} />
      )}
    </motion.button>
  );
}

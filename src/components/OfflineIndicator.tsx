"use client";

import { WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsOnline } from "@/lib/hooks/useIsOnline";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const isOnline = useIsOnline();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{
            type: "spring",
            mass: 1,
            stiffness: 280,
            damping: 60,
          }}
          className={cn(
            "fixed z-40 pointer-events-none flex justify-center",
            "left-0 right-0 px-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+16px)]", // Mobile: Bottom Center above nav
            "md:left-[calc(var(--sidebar-width)+24px)] md:bottom-6 md:top-auto md:right-auto md:px-0 md:justify-start", // Desktop: Bottom Left of content
          )}
        >
          <div className="bg-card text-foreground py-2 px-4 rounded-lg border border-border/80 pointer-events-auto flex items-center gap-3 shadow-none">
            <div className="flex-shrink-0 w-8 h-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
              <WifiOff className="w-4 h-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold tracking-tight">
                You are offline
              </span>
              <span className="text-[11px] text-muted-foreground font-normal">
                Changes will sync when back online
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

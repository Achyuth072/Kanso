"use client";

import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";

interface AddTaskFabProps {
  onClick?: () => void;
  onPointerDown?: () => void;
}

export default function AddTaskFab({
  onClick,
  onPointerDown,
}: AddTaskFabProps) {
  const { trigger, isPhone } = useHaptic();

  return (
    <motion.button
      onTapStart={() => trigger("thud")}
      whileTap={isPhone ? { scale: 0.95 } : {}}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={cn(
        buttonVariants({ size: "lg" }),
        "fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-6 h-14 w-14 rounded-xl shadow-lg md:hidden cursor-pointer z-40",
      )}
    >
      <Plus className="h-6 w-6" strokeWidth={2.5} />
    </motion.button>
  );
}

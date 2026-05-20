"use client";

import React from "react";
import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { priorityTextClasses } from "./task-utils";

interface PriorityBadgeProps {
  priority: number;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  if (!priority || priority >= 4) return null;

  return (
    <span
      className={cn(
        "text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 leading-none",
        priorityTextClasses[priority as 1 | 2 | 3 | 4],
        className,
      )}
    >
      <Flag className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} role="img" />
      <span>P{priority}</span>
    </span>
  );
}

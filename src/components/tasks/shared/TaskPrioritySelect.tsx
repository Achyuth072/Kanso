"use client";

import { cn } from "@/lib/utils";
import { Flag } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useHaptic } from "@/lib/hooks/useHaptic";

export const priorities: {
  value: 1 | 2 | 3 | 4;
  label: string;
  color: string;
}[] = [
  {
    value: 1,
    label: "P1",
    color: "bg-brand text-brand-foreground hover:bg-brand/90",
  },
  {
    value: 2,
    label: "P2",
    color: "bg-secondary/80 text-secondary-foreground",
  },
  { value: 3, label: "P3", color: "bg-secondary/40 text-secondary-foreground" },
  {
    value: 4,
    label: "P4",
    color: "bg-muted text-muted-foreground hover:bg-muted/80",
  },
];

// Priority-specific icon colors for the trigger button
const priorityIconColor: Record<number, string> = {
  1: "text-brand fill-brand/20",
  2: "text-secondary-foreground/80",
  3: "text-muted-foreground/60",
};

interface TaskPrioritySelectProps {
  priority: 1 | 2 | 3 | 4;
  setPriority: (value: 1 | 2 | 3 | 4) => void;
  variant?: "icon" | "compact";
  isMobile?: boolean;
}

export function TaskPrioritySelect({
  priority,
  setPriority,
  isMobile = false,
}: TaskPrioritySelectProps) {
  const { trigger } = useHaptic();
  const isSelected = priority !== 4;

  return (
    <Select
      value={priority.toString()}
      onValueChange={(v) => {
        trigger("tick");
        setPriority(parseInt(v) as 1 | 2 | 3 | 4);
      }}
      onOpenChange={(open) => {
        if (!open) trigger("tick");
      }}
    >
      <SelectTrigger
        onPointerDown={() => trigger("toggle")}
        className={cn(
          // Base — exactly matches the Evening / Subtasks / DatePicker tags
          "h-9 transition-all shrink-0 [&>svg]:hidden shadow-none border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-lg outline-none focus:ring-0 focus:outline-none",
          // Unselected (P4 / Low): icon-only pill
          !isSelected && "w-9 px-0 text-muted-foreground hover:text-foreground",
          // Selected (P1-P3): labelled pill with brand outline active state
          isSelected &&
            "w-auto px-2.5 min-w-[68px] text-[13px] text-brand bg-brand/10 border-transparent hover:bg-brand/20 hover:text-brand",
        )}
        title={!isMobile ? "Set priority" : undefined}
      >
        <div className="flex items-center gap-1.5 justify-center w-full">
          <Flag
            strokeWidth={2.25}
            className={cn(
              "h-4 w-4 transition-all shrink-0",
              isSelected
                ? priorityIconColor[priority]
                : "text-muted-foreground",
            )}
          />
          {isSelected && (
            <span className="text-[13px] font-medium">
              {priorities.find((p) => p.value === priority)?.label}
            </span>
          )}
        </div>
      </SelectTrigger>
      <SelectContent>
        {priorities.map((p) => (
          <SelectItem key={p.value} value={p.value.toString()}>
            <div className="flex items-center gap-2">
              <Flag
                className={cn(
                  "h-3.5 w-3.5",
                  p.value === 4
                    ? "text-muted-foreground"
                    : p.color.split(" ")[0].replace("bg-", "text-"),
                )}
              />
              <span className="font-medium">
                {p.label} —{" "}
                {p.value === 1
                  ? "Urgent"
                  : p.value === 2
                    ? "High"
                    : p.value === 3
                      ? "Normal"
                      : "Low"}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

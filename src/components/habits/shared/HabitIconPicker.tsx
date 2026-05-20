"use client";

import React, { memo } from "react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Flame,
  Heart,
  Dumbbell,
  Book,
  Coffee,
  Moon,
  Droplet,
  Smile,
  Pencil,
  Music,
  Code,
  Leaf,
  Bike,
  Brain,
  Camera,
  Utensils,
  Gamepad2,
  GraduationCap,
  Coins,
  Languages,
  Medal,
  Monitor,
  Pizza,
  Plane,
  Rocket,
  Sun,
  Target,
  Trees,
  User,
  Zap,
} from "lucide-react";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";

const HABIT_ICONS = [
  { name: "Flame", icon: Flame },
  { name: "Heart", icon: Heart },
  { name: "Dumbbell", icon: Dumbbell },
  { name: "Book", icon: Book },
  { name: "Coffee", icon: Coffee },
  { name: "Moon", icon: Moon },
  { name: "Droplet", icon: Droplet },
  { name: "Smile", icon: Smile },
  { name: "Pencil", icon: Pencil },
  { name: "Music", icon: Music },
  { name: "Code", icon: Code },
  { name: "Leaf", icon: Leaf },
  { name: "Bike", icon: Bike },
  { name: "Brain", icon: Brain },
  { name: "Camera", icon: Camera },
  { name: "Cooking", icon: Utensils },
  { name: "Gamepad", icon: Gamepad2 },
  { name: "Graduation", icon: GraduationCap },
  { name: "Finances", icon: Coins },
  { name: "Language", icon: Languages },
  { name: "Medal", icon: Medal },
  { name: "Monitor", icon: Monitor },
  { name: "Pizza", icon: Pizza },
  { name: "Plane", icon: Plane },
  { name: "Rocket", icon: Rocket },
  { name: "Sun", icon: Sun },
  { name: "Target", icon: Target },
  { name: "Trees", icon: Trees },
  { name: "User", icon: User },
  { name: "Zap", icon: Zap },
];

export function getHabitIcon(iconName: string | null | undefined) {
  if (!iconName) return Flame; // Default icon
  const found = HABIT_ICONS.find((item) => item.name === iconName);
  return found ? found.icon : Flame;
}

interface HabitIconPickerProps {
  value: string;
  onChange: (value: string) => void;
  color?: string;
  variant?: "grid" | "compact" | "hero";
}

const IconButton = memo(
  ({
    item,
    isSelected,
    onSelect,
    variant,
  }: {
    item: (typeof HABIT_ICONS)[0];
    isSelected: boolean;
    onSelect: (name: string) => void;
    variant: "grid" | "compact" | "hero";
  }) => {
    const Icon = item.icon;
    return (
      <button
        type="button"
        title={item.name}
        aria-label={item.name}
        role="radio"
        aria-checked={isSelected}
        onClick={() => onSelect(item.name)}
        className={cn(
          "h-10 transition-all shrink-0 border rounded-lg shadow-none flex items-center justify-center transform-gpu",
          isSelected
            ? "text-brand bg-brand/10 border-transparent font-semibold"
            : "border-border/50 bg-background hover:bg-secondary text-muted-foreground hover:text-foreground",
          variant === "compact" ? "w-10 px-0" : "px-3 min-w-[40px]",
        )}
      >
        <Icon
          strokeWidth={isSelected ? 2.5 : 2}
          className={cn("h-5 w-5", isSelected ? "scale-110" : "")}
        />
      </button>
    );
  },
);
IconButton.displayName = "IconButton";

export function HabitIconPicker({
  value,
  onChange,
  variant = "grid",
  color = "#4B6CB7",
}: HabitIconPickerProps) {
  const { trigger } = useHaptic();
  const scrollRef = useHorizontalScroll();

  const handleSelect = React.useCallback(
    (name: string) => {
      trigger("toggle");
      onChange(name);
    },
    [trigger, onChange],
  );

  return (
    <div className="grid gap-3 w-full overflow-hidden">
      {/* Featured Icon Preview */}
      <div>
        <div className="flex flex-col items-center justify-center py-4 rounded-xl bg-secondary/10 border border-border/40 relative overflow-hidden group">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-background border border-border shadow-none group-hover:scale-105"
            style={{ color: color }}
          >
            {React.createElement(getHabitIcon(value), {
              strokeWidth: 2.25,
              className: "h-6 w-6",
            })}
          </div>
          <div className="mt-2 flex flex-col items-center">
            <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-[0.2em]">
              Selected
            </span>
            <span className="text-xs font-medium text-foreground capitalize tracking-tight">
              {value || "Flame"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 overflow-hidden">
        {variant !== "compact" && (
          <Label className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.2em]">
            Choose Symbol
          </Label>
        )}
        <div
          ref={scrollRef}
          className="flex flex-nowrap gap-2.5 overflow-x-auto scrollbar-hide py-1 px-4 -mx-4"
          role="radiogroup"
          aria-label="Habit icon selection"
        >
          {HABIT_ICONS.map((item) => (
            <IconButton
              key={item.name}
              item={item}
              isSelected={value === item.name}
              variant={variant}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

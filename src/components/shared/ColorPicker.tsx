"use client";

import React, { memo } from "react";
import { useHaptic } from "@/lib/hooks/useHaptic";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { useHorizontalScroll } from "@/lib/hooks/useHorizontalScroll";
import { PROJECT_COLORS } from "@/lib/constants/colors";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  variant?: "grid" | "compact";
  label?: string;
  ariaLabel?: string;
  className?: string;
}

const ColorButton = memo(
  ({
    color,
    isSelected,
    onSelect,
    variant,
  }: {
    color: (typeof PROJECT_COLORS)[0];
    isSelected: boolean;
    onSelect: (hex: string) => void;
    variant: "grid" | "compact";
  }) => (
    <button
      type="button"
      title={color.name}
      aria-label={color.name}
      role="radio"
      aria-checked={isSelected}
      onClick={() => onSelect(color.hex)}
      className={cn(
        variant === "compact" ? "h-7 w-7" : "h-9 w-9",
        "rounded-xl transition-all shrink-0 border border-white/10",
        isSelected
          ? "ring-2 ring-brand ring-offset-2 ring-offset-background scale-110 opacity-100"
          : variant === "compact"
            ? "opacity-60 hover:opacity-100 hover:scale-105"
            : "opacity-70 hover:opacity-90 hover:scale-105",
      )}
      style={{
        backgroundColor: color.hex,
      }}
    />
  ),
);
ColorButton.displayName = "ColorButton";

export function ColorPicker({
  value,
  onChange,
  variant = "grid",
  label = "Color",
  ariaLabel = "Select color",
  className,
}: ColorPickerProps) {
  const { trigger } = useHaptic();
  const scrollRef = useHorizontalScroll();

  const handleSelect = React.useCallback(
    (hex: string) => {
      trigger("toggle");
      onChange(hex);
    },
    [trigger, onChange],
  );

  if (variant === "compact") {
    return (
      <div
        ref={scrollRef}
        data-testid="color-picker"
        className={cn(
          "flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 px-2 -mx-2 flex-nowrap",
          className,
        )}
        role="radiogroup"
        aria-label={ariaLabel}
      >
        {PROJECT_COLORS.map((c) => (
          <ColorButton
            key={c.hex}
            color={c}
            isSelected={value === c.hex}
            variant="compact"
            onSelect={handleSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      data-testid="color-picker"
      className={cn("grid gap-1.5 w-full", className)}
    >
      {label && (
        <Label className="text-xs text-muted-foreground/60">{label}</Label>
      )}
      <div
        ref={scrollRef}
        className="flex flex-nowrap gap-2.5 overflow-x-auto scrollbar-hide py-3 px-2 -mx-2"
        role="radiogroup"
        aria-label={ariaLabel}
      >
        {PROJECT_COLORS.map((c) => (
          <ColorButton
            key={c.hex}
            color={c}
            isSelected={value === c.hex}
            variant="grid"
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}

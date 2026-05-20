import React from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";

interface DragHandleProps {
  dragListeners?: DraggableSyntheticListeners;
  dragAttributes?: DraggableAttributes;
  variant?: "desktop" | "mobile";
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  className?: string;
}

export const DragHandle = React.forwardRef<HTMLDivElement, DragHandleProps>(
  (
    {
      dragListeners,
      dragAttributes,
      variant = "desktop",
      onPointerDown,
      onPointerUp,
      className,
    },
    ref,
  ) => {
    const isDesktop = variant === "desktop";

    return (
      <div
        ref={ref}
        {...dragListeners}
        {...dragAttributes}
        onPointerDown={(e) => {
          e.stopPropagation();
          onPointerDown?.();
          dragListeners?.onPointerDown?.(e);
        }}
        onPointerUp={() => {
          onPointerUp?.();
        }}
        onPointerCancel={() => {
          onPointerUp?.();
        }}
        className={cn(
          "relative cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground transition-opacity",
          // Increase touch target on mobile using an invisible pseudo-element
          !isDesktop &&
            "after:absolute after:-inset-3 after:content-[''] after:z-10",
          isDesktop ? "opacity-0 group-hover:opacity-100" : "shrink-0",
          className,
        )}
        style={isDesktop ? undefined : { touchAction: "none" }}
      >
        <GripVertical className={cn(isDesktop ? "h-4 w-4" : "h-5 w-5")} />
      </div>
    );
  },
);

DragHandle.displayName = "DragHandle";

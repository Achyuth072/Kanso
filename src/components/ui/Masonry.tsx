import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";

interface MasonryProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  getItemId?: (item: T) => string | number;
  className?: string;
  columnClassName?: string;
  gap?: number | string;
}

/**
 * A simple masonry-style layout component using CSS grid and column filtering.
 * Follows the Zen-Modernism principles of structured columns and balanced "Ma" (whitespace).
 */
export function Masonry<T>({
  items,
  renderItem,
  getItemId,
  className,
  columnClassName,
  gap = 4,
}: MasonryProps<T>) {
  const gapClass = typeof gap === "number" ? `gap-${gap}` : gap;
  const isSm = useMediaQuery("(min-width: 640px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const colCount = isLg ? 3 : isSm ? 2 : 1;

  const columns = useMemo(() => {
    if (!items.length) return { c1: [] as T[], c2: [] as T[], c3: [] as T[] };

    if (colCount === 1) {
      return { c1: items, c2: [] as T[], c3: [] as T[] };
    }
    if (colCount === 2) {
      return {
        c1: items.filter((_, i) => i % 2 === 0),
        c2: items.filter((_, i) => i % 2 === 1),
        c3: [] as T[],
      };
    }
    return {
      c1: items.filter((_, i) => i % 3 === 0),
      c2: items.filter((_, i) => i % 3 === 1),
      c3: items.filter((_, i) => i % 3 === 2),
    };
  }, [items, colCount]);

  if (!items.length) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        gapClass,
        className,
      )}
    >
      {/* Column 1 (Always visible) */}
      <div className={cn("flex flex-col", gapClass, columnClassName)}>
        {columns.c1.map((item, idx) => (
          <React.Fragment key={getItemId?.(item) ?? idx}>
            {renderItem(item)}
          </React.Fragment>
        ))}
      </div>

      {/* Column 2 (Visible on sm+) */}
      <div className={cn("hidden sm:flex flex-col", gapClass, columnClassName)}>
        {columns.c2.map((item, idx) => (
          <React.Fragment key={getItemId?.(item) ?? idx}>
            {renderItem(item)}
          </React.Fragment>
        ))}
      </div>

      {/* Column 3 (Visible on lg+) */}
      <div className={cn("hidden lg:flex flex-col", gapClass, columnClassName)}>
        {columns.c3.map((item, idx) => (
          <React.Fragment key={getItemId?.(item) ?? idx}>
            {renderItem(item)}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

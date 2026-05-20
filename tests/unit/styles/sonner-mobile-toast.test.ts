import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Sonner mobile toast override", () => {
  it("keeps mobile width overrides off the toast transform property", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

    expect(css).toMatch(
      /\[data-sonner-toaster\]\[data-x-position="center"\]\s+\[data-sonner-toast\]/,
    );
    expect(css).toContain("transform: translateX(-50%) !important;");
    expect(css).not.toContain("translate: -50% 0 !important;");
    expect(css).not.toContain('[data-sonner-toast][data-mounted="true"]');
  });
});

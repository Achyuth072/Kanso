import { render, screen } from "@testing-library/react";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import { describe, it, expect } from "vitest";

// Mock ResizeObserver and scrollIntoView for cmdk
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.HTMLElement.prototype.scrollIntoView = function () {};
window.HTMLElement.prototype.releasePointerCapture = function () {};
window.HTMLElement.prototype.hasPointerCapture = function () {
  return false;
};

describe("Command Menu Styles", () => {
  it("TC-CMD-01: CommandItem should have correct selection classes for Light Mode", () => {
    render(
      <Command>
        <CommandList>
          <CommandItem data-selected="true" data-testid="cmd-item">
            Test Item
          </CommandItem>
        </CommandList>
      </Command>,
    );

    const item = screen.getByTestId("cmd-item");
    const className = item.className;
    console.log("Light Mode ClassName:", className);

    // Check for Brand Selection
    expect(className).toContain("data-[selected=true]:bg-brand");
    expect(className).toContain("data-[selected=true]:text-brand-foreground");
  });

  it("TC-CMD-02: CommandItem should have correct selection classes for Dark Mode", () => {
    render(
      <Command>
        <CommandList>
          <CommandItem data-selected="true" data-testid="cmd-item">
            Test Item
          </CommandItem>
        </CommandList>
      </Command>,
    );

    const item = screen.getByTestId("cmd-item");
    const className = item.className;
    console.log("Dark Mode ClassName:", className);

    // Check for Brand Selection (consistent across modes)
    expect(className).toContain("data-[selected=true]:bg-brand");
    expect(className).toContain("data-[selected=true]:text-brand-foreground");
  });

  it("TC-CMD-05: CommandItem should NOT use text-primary-foreground in Dark Mode selection (Low Contrast)", () => {
    render(
      <Command>
        <CommandList>
          <CommandItem data-selected="true" data-testid="cmd-item">
            Test Item
          </CommandItem>
        </CommandList>
      </Command>,
    );

    const item = screen.getByTestId("cmd-item");
    const className = item.className;

    // We explicitly want to ensure we ARE NOT using this class in dark mode
    // The current implementation likely DOES include this, so this test might fail initially (or pass if I invert logic, but for TDD 'RED' state, let's assert what we WANT)

    // Current Bad State: Uses dark:data-[selected=true]:!text-primary-foreground
    // We Want: NOT to use it.

    // However, for typical TDD, we often write the "Positive" test first.
    // Let's assert that it DOES NOT contain the bad class mapping.
    expect(className).not.toContain(
      "dark:data-[selected=true]:!text-primary-foreground",
    );
  });

  it("TC-CMD-06: CommandItem SHOULD use high-contrast text in Dark Mode selection", () => {
    render(
      <Command>
        <CommandList>
          <CommandItem data-selected="true" data-testid="cmd-item">
            Test Item
          </CommandItem>
        </CommandList>
      </Command>,
    );

    const item = screen.getByTestId("cmd-item");
    const className = item.className;

    // We expect brand-foreground text for legibility on blue background
    expect(className).toContain("data-[selected=true]:text-brand-foreground");
  });
});

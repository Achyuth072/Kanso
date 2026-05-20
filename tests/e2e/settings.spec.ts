import { test, expect } from "@playwright/test";

test.describe("Focus Settings (Guest Mode)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    if (page.url().includes("/login")) {
      const guestBtn = page.getByRole("button", { name: /continue as guest/i });
      await expect(guestBtn).toBeVisible({ timeout: 10000 });
      await guestBtn.click();
      await page.waitForURL("/", { timeout: 10000 });
    }
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("should persist focus duration changes", async ({ page }) => {
    const settingsBtn = page.getByRole("button", { name: "Settings" });

    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
    } else {
      const menuBtn = page.getByRole("button", { name: /open menu/i });
      if (await menuBtn.isVisible()) await menuBtn.click();
      await settingsBtn.click();
    }

    await expect(
      page.getByRole("heading", { name: /settings/i }).first(),
    ).toBeVisible();

    const slider = page.getByRole("slider", { name: "Focus Duration" });
    await slider.focus();
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("ArrowRight");
    }

    await page.getByRole("button", { name: "Save Changes" }).click();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
    } else {
      await page.getByRole("button", { name: /open menu/i }).click();
      await settingsBtn.click();
    }

    const newSlider = page.getByRole("slider", { name: "Focus Duration" });
    const value = await newSlider.getAttribute("aria-valuenow");

    expect(Number(value)).toBeGreaterThan(25);
  });
});

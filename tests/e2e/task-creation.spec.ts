import { test, expect } from "@playwright/test";

test.describe("Task Creation (Guest Mode)", () => {
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

  test("should create a new task successfully via shortcut", async ({
    page,
  }) => {
    const taskContent = `Test Task ${Date.now()}`;
    await page.keyboard.press("n");
    await expect(page.getByRole("heading", { name: "New Task" })).toBeVisible();
    await page.getByPlaceholder("What needs to be done?").fill(taskContent);
    await page.getByRole("button", { name: /create task/i }).click();
    await expect(page.getByText(taskContent)).toBeVisible();
  });

  test("should have disabled submit button when content is empty", async ({
    page,
  }) => {
    await page.keyboard.press("n");

    await expect(page.getByRole("heading", { name: "New Task" })).toBeVisible();

    const createBtn = page.getByRole("button", { name: /create task/i });

    await expect(createBtn).toBeDisabled();

    const input = page.getByPlaceholder("What needs to be done?");
    await input.fill("a");
    await expect(createBtn).toBeEnabled();
    await input.fill("");
    await expect(createBtn).toBeDisabled();
  });
});

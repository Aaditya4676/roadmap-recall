import { expect, test } from "@playwright/test";

const fixedTime = new Date("2026-07-22T06:30:00.000Z");
const screenshotOptions = {
  animations: "disabled" as const,
  caret: "hide" as const,
  scale: "css" as const,
};

test.describe("light theme visual regression", () => {
  test.use({ colorScheme: "light" });

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(fixedTime);
  });

  test("landing page composition", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Remember what you learn/i })).toBeVisible();
    await expect(page).toHaveScreenshot("landing-light.png", { ...screenshotOptions, fullPage: true });
  });

  test("daily review surface", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.getByText(/everything here stays in this browser/i)).toBeVisible();
    await expect(page).toHaveScreenshot("today-light.png", { ...screenshotOptions, fullPage: true });
  });

  test("activity surface", async ({ page }) => {
    await page.goto("/demo?view=activity");
    await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot("activity-light.png", { ...screenshotOptions, fullPage: true });
  });

  test("saved-topic library", async ({ page }) => {
    await page.goto("/demo?view=library");
    await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible();
    await expect(page).toHaveScreenshot("library-light.png", { ...screenshotOptions, fullPage: true });
  });

  test("capture dialog", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: /Add what I learned/i }).click();
    const dialog = page.getByRole("dialog", { name: "Add a learned topic" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveScreenshot("capture-dialog-light.png", screenshotOptions);
  });
});

test.describe("dark theme visual regression", () => {
  test.use({ colorScheme: "dark" });

  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(fixedTime);
  });

  test("landing page composition", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Remember what you learn/i })).toBeVisible();
    await page.locator(".liquid-panel").last().hover();
    await expect(page).toHaveScreenshot("landing-dark.png", { ...screenshotOptions, fullPage: true });
  });

  test("topic dialog remains stable on hover", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: /Active recall/i }).click();
    const dialog = page.getByRole("dialog", { name: "Active recall" });
    await expect(dialog).toBeVisible();
    const before = await dialog.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    await dialog.hover({ position: { x: 200, y: 280 } });
    await expect(dialog).not.toHaveAttribute("data-liquid-active");
    expect(await dialog.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }))).toEqual(before);
    await expect(dialog).toHaveScreenshot("topic-dialog-dark-hover.png", screenshotOptions);
  });
});

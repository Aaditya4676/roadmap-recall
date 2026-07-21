import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing page leads to an isolated, accessible demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Remember what you learn/i })).toBeVisible();
  await page.getByRole("link", { name: /Open local demo/i }).click();
  await expect(page.getByText(/everything here stays in this browser/i)).toBeVisible();
  const viewport = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("quick capture schedules a local topic without a network write", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: /Add what I learned/i }).click();
  await page.getByRole("textbox", { name: "Topic", exact: true }).fill("AbortController ownership");
  await page.getByRole("textbox", { name: /My notes/ }).fill("The creator owns cancellation and passes the signal downstream.");
  await page.getByRole("button", { name: /Save and schedule/i }).click();
  await page.goto("/demo?view=roadmap");
  await expect(page.getByText("AbortController ownership")).toBeVisible();
});

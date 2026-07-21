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

test("migrates an existing v1 demo without losing local topics", async ({ page }) => {
  const legacyTopic = {
    id: "local-legacy-topic",
    title: "My saved legacy topic",
    breadcrumb: "Personal topics",
    kind: "knowledge",
    part: "frontend",
    learnedOn: "2026-07-20",
    activatedAt: "2026-07-20T05:00:00.000Z",
    scheduler: "fixed",
    keepWarmDays: 30,
    note: { markdown: "Still here", revision: 1, updatedAt: "2026-07-20T05:00:00.000Z" },
    reviewState: {
      scheduler: "fixed",
      dueAt: "2099-01-01T06:30:00.000Z",
      dueOn: "2099-01-01",
      lastReviewedAt: null,
      reviewCount: 0,
      fixedStage: 0,
      fsrsCard: null,
    },
  };
  await page.addInitScript((topic) => {
    localStorage.setItem("roadmap-recall-demo-v1", JSON.stringify([topic]));
  }, legacyTopic);
  await page.goto("/demo?view=roadmap");
  await expect(page.getByText("My saved legacy topic")).toBeVisible();
  expect(await page.evaluate(() => ({
    migrated: Boolean(localStorage.getItem("roadmap-recall-demo-v2")),
    legacyRemoved: localStorage.getItem("roadmap-recall-demo-v1") === null,
  }))).toEqual({ migrated: true, legacyRemoved: true });
});

test("activity keeps gaps truthful while showing later recovery", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("link", { name: "Activity" }).click();
  await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
  await expect(page.getByText(/of the last 7 days/i)).toBeVisible();

  const recoveredDay = page.getByRole("button", { name: /completed later/i }).first();
  await recoveredDay.click();
  await expect(page.getByText(/completed later/i).last()).toBeVisible();

  const calendar = page.getByRole("group", { name: /Learning activity calendar/i });
  const firstVisibleDay = calendar.getByRole("button").first();
  await firstVisibleDay.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(firstVisibleDay).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(calendar.getByRole("button").nth(7)).toBeFocused();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

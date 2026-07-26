import { expect, test, type Page } from "@playwright/test";

const fixedTime = new Date("2026-07-22T06:30:00.000Z");
const screenshotOptions = {
  animations: "disabled" as const,
  caret: "hide" as const,
  scale: "css" as const,
};

async function freezeThemeRevealAtMidpoint(page: Page) {
  await expect(page.locator("html")).toHaveClass(/theme-transition-active/);
  await expect.poll(() => page.evaluate(() => document.getAnimations().some((animation) => {
    const effect = animation.effect as KeyframeEffect | null;
    return effect?.pseudoElement?.includes("view-transition-new(root)");
  }))).toBe(true);
  await page.evaluate(async () => {
    const reveal = document.getAnimations().find((animation) => {
      const effect = animation.effect as KeyframeEffect | null;
      return effect?.pseudoElement?.includes("view-transition-new(root)");
    });

    if (!reveal) throw new Error("Theme reveal animation was not created");
    const effect = reveal.effect as KeyframeEffect;
    const duration = Number(effect.getTiming().duration);
    reveal.pause();
    reveal.currentTime = Number.isFinite(duration) ? duration / 2 : 380;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

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

  test("theme reveal midpoint", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("roadmap-recall-theme", "light");
    });
    await page.goto("/demo");
    const toggle = page.getByRole("button", { name: "Toggle color theme" });
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    await freezeThemeRevealAtMidpoint(page);

    await expect(page).toHaveScreenshot("theme-reveal-midpoint-light-to-dark.png", {
      ...screenshotOptions,
      animations: "allow",
    });
  });

  test("navigation ripple midpoint", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("link", { name: "Library", exact: true }).dispatchEvent("click");
    const ripple = page.locator("[data-navigation-ripple]");
    await expect(ripple).toBeVisible();
    await page.evaluate(() => {
      const source = document.querySelector<HTMLElement>("[data-navigation-ripple]");
      if (!source) throw new Error("Navigation ripple was not created");
      const clone = source.cloneNode(true) as HTMLElement;
      clone.dataset.navigationRipplePreview = "true";
      clone.style.visibility = "hidden";
      document.body.appendChild(clone);
      source.style.visibility = "hidden";
    });
    await expect(page.getByRole("heading", { name: "Library", exact: true })).toBeVisible({ timeout: 10_000 });

    const maxWaveOpacity = await page.evaluate(async () => {
      const clone = document.querySelector<HTMLElement>("[data-navigation-ripple-preview]");
      if (!clone) throw new Error("Navigation ripple preview was not preserved");
      clone.classList.remove("is-settling", "is-static", "is-stalled", "is-paused");
      clone.classList.add("is-rippling");
      clone.style.opacity = "1";
      clone.style.transition = "none";
      clone.style.visibility = "visible";
      void clone.offsetWidth;

      const origin = clone.querySelector<HTMLElement>(".navigation-ripple-origin");
      for (const animation of origin?.getAnimations() ?? []) {
        animation.pause();
        animation.currentTime = 450;
      }
      clone.querySelectorAll<HTMLElement>(".navigation-ripple-wave").forEach((wave, index) => {
        const animations = wave.getAnimations();
        if (!animations.length) throw new Error("Navigation ripple wave animation was not created");
        for (const animation of animations) {
          animation.pause();
          animation.currentTime = 760 + index * 260;
        }
      });

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const animatedElements = clone.querySelectorAll<HTMLElement>(
        ".navigation-ripple-origin, .navigation-ripple-wave",
      );
      const waveOpacity = Array.from(
        clone.querySelectorAll<HTMLElement>(".navigation-ripple-wave"),
        (wave) => Number(getComputedStyle(wave).opacity),
      );

      animatedElements.forEach((element) => {
        const style = getComputedStyle(element);
        const frozenStyle = {
          boxShadow: style.boxShadow,
          opacity: style.opacity,
          transform: style.transform,
        };
        element.getAnimations().forEach((animation) => animation.cancel());
        element.style.animation = "none";
        element.style.boxShadow = frozenStyle.boxShadow;
        element.style.opacity = frozenStyle.opacity;
        element.style.transform = frozenStyle.transform;
      });

      return Math.max(...waveOpacity);
    });
    expect(maxWaveOpacity).toBeGreaterThan(0.2);

    const screenshot = await page.screenshot({
      ...screenshotOptions,
      animations: "allow",
    });
    expect(screenshot).toMatchSnapshot("navigation-ripple-midpoint-light.png", {
      maxDiffPixels: 60,
    });
  });

  test("mobile landing theme reveal midpoint", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile viewport regression only");
    await page.addInitScript(() => {
      localStorage.setItem("roadmap-recall-theme", "light");
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle color theme" }).click();
    await freezeThemeRevealAtMidpoint(page);
    await expect(page).toHaveScreenshot("mobile-landing-theme-reveal-light-to-dark.png", {
      ...screenshotOptions,
      animations: "allow",
    });
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

  test("question-led recall prompt", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: /Start review/i }).click();
    const dialog = page.getByRole("dialog", { name: "Review Active recall" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveScreenshot("structured-recall-light.png", screenshotOptions);
  });

  test("focused recall editor", async ({ page }) => {
    await page.goto("/demo");
    await page.getByRole("button", { name: /Start review/i }).click();
    const review = page.getByRole("dialog", { name: "Review Active recall" });
    await review.getByRole("button", { name: /Expand Question 1:/i }).click();
    const focused = page.getByRole("dialog", { name: /Question 1:/i });
    await expect(focused).toBeVisible();
    await expect(focused).toHaveScreenshot("focused-recall-light.png", screenshotOptions);
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

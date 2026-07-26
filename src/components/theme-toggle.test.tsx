import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";

function mockMotionPreference(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: undefined,
  });
  localStorage.clear();

  const root = document.documentElement;
  delete root.dataset.theme;
  root.classList.remove("theme-transition-active");
  root.style.removeProperty("--theme-transition-x");
  root.style.removeProperty("--theme-transition-y");
  root.style.removeProperty("--theme-transition-radius");
});

describe("ThemeToggle", () => {
  it("changes themes immediately when reduced motion is requested", () => {
    document.documentElement.dataset.theme = "light";
    mockMotionPreference(true);
    const startViewTransition = vi.fn();
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle color theme" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("roadmap-recall-theme")).toBe("dark");
    expect(startViewTransition).not.toHaveBeenCalled();
    expect(document.documentElement).not.toHaveClass("theme-transition-active");
  });

  it("reveals the next theme from the clicked button and cleans up afterward", async () => {
    document.documentElement.dataset.theme = "light";
    mockMotionPreference(false);
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const startViewTransition = vi.fn((update: () => void) => {
      update();
      return { finished };
    });
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Toggle color theme" });
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      x: 20,
      y: 30,
      width: 40,
      height: 40,
      top: 30,
      right: 60,
      bottom: 70,
      left: 20,
      toJSON: () => ({}),
    });

    fireEvent.click(button);
    fireEvent.click(button);

    const root = document.documentElement;
    expect(startViewTransition).toHaveBeenCalledTimes(1);
    expect(root.dataset.theme).toBe("dark");
    expect(localStorage.getItem("roadmap-recall-theme")).toBe("dark");
    expect(root).toHaveClass("theme-transition-active");
    expect(root.style.getPropertyValue("--theme-transition-x")).toBe("40px");
    expect(root.style.getPropertyValue("--theme-transition-y")).toBe("50px");
    expect(Number.parseFloat(root.style.getPropertyValue("--theme-transition-radius"))).toBeGreaterThan(1000);
    expect(button).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      finish();
      await finished;
    });

    await waitFor(() => expect(root).not.toHaveClass("theme-transition-active"));
    expect(root.style.getPropertyValue("--theme-transition-x")).toBe("");
    expect(root.style.getPropertyValue("--theme-transition-y")).toBe("");
    expect(root.style.getPropertyValue("--theme-transition-radius")).toBe("");
    expect(button).not.toHaveAttribute("aria-busy");
  });
});

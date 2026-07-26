"use client";

import { Moon, Sun } from "lucide-react";
import { useRef, type MouseEvent } from "react";

type Theme = "light" | "dark";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    finished: Promise<void>;
  };
};

function commitTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;

  try {
    localStorage.setItem("roadmap-recall-theme", theme);
  } catch {
    // The visible preference still changes if storage is unavailable.
  }
}

export function ThemeToggle() {
  const transitioning = useRef(false);

  async function toggle(event: MouseEvent<HTMLButtonElement>) {
    const root = document.documentElement;

    if (transitioning.current || root.classList.contains("theme-transition-active")) {
      return;
    }

    const next: Theme = root.dataset.theme === "dark" ? "light" : "dark";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const transitionDocument = document as ViewTransitionDocument;

    if (!transitionDocument.startViewTransition || reducedMotion) {
      commitTheme(next);
      return;
    }

    const source = event.currentTarget;
    const bounds = source.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const viewportWidth = Math.max(
      window.innerWidth,
      root.clientWidth,
      window.visualViewport?.width ?? 0,
    );
    const viewportHeight = Math.max(
      window.innerHeight,
      root.clientHeight,
      window.visualViewport?.height ?? 0,
    );
    const farthestX = Math.max(x, viewportWidth - x);
    const farthestY = Math.max(y, viewportHeight - y);
    const radius = Math.ceil(Math.hypot(farthestX, farthestY) * 1.08 + 48);

    transitioning.current = true;
    source.setAttribute("aria-busy", "true");
    root.style.setProperty("--theme-transition-x", `${x}px`);
    root.style.setProperty("--theme-transition-y", `${y}px`);
    root.style.setProperty("--theme-transition-radius", `${radius}px`);
    root.classList.add("theme-transition-active");

    try {
      const transition = transitionDocument.startViewTransition(() => {
        commitTheme(next);
      });

      await transition.finished;
    } catch {
      commitTheme(next);
    } finally {
      root.classList.remove("theme-transition-active");
      root.style.removeProperty("--theme-transition-x");
      root.style.removeProperty("--theme-transition-y");
      root.style.removeProperty("--theme-transition-radius");
      source.removeAttribute("aria-busy");
      transitioning.current = false;
    }
  }

  return (
    <button
      className="button-ghost !size-10 !min-h-10 !p-0"
      data-liquid
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
    >
      <Moon className="theme-icon-light" size={18} />
      <Sun className="theme-icon-dark" size={18} />
    </button>
  );
}

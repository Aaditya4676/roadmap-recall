"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("roadmap-recall-theme", next);
  }

  return (
    <button className="button-ghost !size-10 !min-h-10 !p-0" data-liquid type="button" onClick={toggle} aria-label="Toggle color theme">
      <Moon className="theme-icon-light" size={18} />
      <Sun className="theme-icon-dark" size={18} />
    </button>
  );
}

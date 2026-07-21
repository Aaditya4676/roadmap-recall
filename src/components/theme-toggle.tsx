"use client";

import { Moon } from "lucide-react";

export function ThemeToggle() {
  function toggle() {
    const next = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("roadmap-recall-theme", next ? "dark" : "light");
  }

  return (
    <button className="button-ghost !min-h-10 !px-3" type="button" onClick={toggle} aria-label="Toggle color theme">
      <Moon size={18} />
    </button>
  );
}

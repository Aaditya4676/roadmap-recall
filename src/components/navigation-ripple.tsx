"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

export const NAVIGATION_RIPPLE_MIN_MS = 460;
export const NAVIGATION_RIPPLE_FADE_MS = 160;
export const NAVIGATION_RIPPLE_STALL_MS = 9_000;
export const NAVIGATION_RIPPLE_GIVE_UP_MS = 15_000;

export type NavigationRipplePhase = "rippling" | "static" | "stalled" | "settling";

export type NavigationRippleState = {
  id: number;
  x: number;
  y: number;
  label: string;
  originKey: string;
  targetKey: string;
  startedAt: number;
  phase: NavigationRipplePhase;
  contentCommitted: boolean;
};

type NavigationRippleStart = {
  x: number;
  y: number;
  label: string;
  targetKey: string;
  reducedMotion: boolean;
};

type NavigationActivation = {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  sameTarget: boolean;
  themeTransitionActive: boolean;
};

type PlainNavigationActivation = Omit<NavigationActivation, "sameTarget" | "themeTransitionActive">;

type NavigationOriginInput = {
  clientX: number;
  clientY: number;
  detail: number;
  currentTarget: {
    getBoundingClientRect: () => Pick<DOMRect, "left" | "top" | "width" | "height">;
  };
};

function routePath(value: string): string {
  const path = value.split(/[?#]/, 1)[0] || "/";
  return path.length > 1 ? path.replace(/\/$/, "") : path;
}

export function isSameNavigationTarget(pathname: string, href: string): boolean {
  const current = routePath(pathname);
  const target = routePath(href);
  return current === target || (target !== "/" && current.startsWith(`${target}/`));
}

export function isPlainNavigationActivation(input: PlainNavigationActivation): boolean {
  return !input.defaultPrevented
    && input.button === 0
    && !input.metaKey
    && !input.ctrlKey
    && !input.shiftKey
    && !input.altKey;
}

export function shouldStartNavigationRipple(input: NavigationActivation): boolean {
  return isPlainNavigationActivation(input)
    && !input.sameTarget
    && !input.themeTransitionActive;
}

export function shouldCancelNavigationRipple(input: NavigationActivation): boolean {
  return isPlainNavigationActivation(input) && input.sameTarget;
}

export function getNavigationRippleOrigin(input: NavigationOriginInput): { x: number; y: number } {
  if (input.detail > 0) {
    return { x: input.clientX, y: input.clientY };
  }

  const bounds = input.currentTarget.getBoundingClientRect();
  return {
    x: bounds.left + bounds.width / 2,
    y: bounds.top + bounds.height / 2,
  };
}

export function useNavigationRipple(navigationKey: string) {
  const [ripple, setRipple] = useState<NavigationRippleState | null>(null);
  const rippleRef = useRef<NavigationRippleState | null>(null);
  const sequence = useRef(0);
  const settleTimer = useRef<number | null>(null);
  const removeTimer = useRef<number | null>(null);
  const stallTimer = useRef<number | null>(null);
  const giveUpTimer = useRef<number | null>(null);

  const replaceRipple = useCallback((next: NavigationRippleState | null) => {
    rippleRef.current = next;
    setRipple(next);
  }, []);

  const clearTimers = useCallback(() => {
    for (const timer of [settleTimer, removeTimer, stallTimer, giveUpTimer]) {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const beginSettling = useCallback((id: number) => {
    const current = rippleRef.current;
    if (!current || current.id !== id) return;

    replaceRipple({ ...current, phase: "settling", contentCommitted: true });
    removeTimer.current = window.setTimeout(() => {
      if (rippleRef.current?.id === id) replaceRipple(null);
    }, NAVIGATION_RIPPLE_FADE_MS);
  }, [replaceRipple]);

  const begin = useCallback((input: NavigationRippleStart) => {
    clearTimers();
    const id = sequence.current + 1;
    sequence.current = id;
    const next: NavigationRippleState = {
      id,
      x: input.x,
      y: input.y,
      label: input.label,
      originKey: navigationKey,
      targetKey: input.targetKey,
      startedAt: Date.now(),
      phase: input.reducedMotion ? "static" : "rippling",
      contentCommitted: false,
    };
    replaceRipple(next);

    stallTimer.current = window.setTimeout(() => {
      stallTimer.current = null;
      const current = rippleRef.current;
      if (!current || current.id !== id || current.contentCommitted) return;
      replaceRipple({ ...current, phase: "stalled" });
    }, NAVIGATION_RIPPLE_STALL_MS);

    giveUpTimer.current = window.setTimeout(() => {
      giveUpTimer.current = null;
      beginSettling(id);
    }, NAVIGATION_RIPPLE_GIVE_UP_MS);
  }, [beginSettling, clearTimers, navigationKey, replaceRipple]);

  const cancel = useCallback(() => {
    clearTimers();
    replaceRipple(null);
  }, [clearTimers, replaceRipple]);

  useEffect(() => {
    const current = rippleRef.current;
    if (!current || current.contentCommitted || navigationKey === current.originKey) return;

    if (stallTimer.current !== null) {
      window.clearTimeout(stallTimer.current);
      stallTimer.current = null;
    }
    if (giveUpTimer.current !== null) {
      window.clearTimeout(giveUpTimer.current);
      giveUpTimer.current = null;
    }

    replaceRipple({ ...current, contentCommitted: true });
    const remaining = Math.max(0, NAVIGATION_RIPPLE_MIN_MS - (Date.now() - current.startedAt));
    settleTimer.current = window.setTimeout(() => beginSettling(current.id), remaining);
  }, [beginSettling, navigationKey, replaceRipple]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return {
    ripple,
    begin,
    cancel,
    busy: Boolean(ripple && !ripple.contentCommitted),
  };
}

export function NavigationRipple({ state }: { state: NavigationRippleState | null }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!state) return;
    const sync = () => setPaused(document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [state]);

  if (!state) return null;

  const style = {
    "--navigation-ripple-x": `${state.x}px`,
    "--navigation-ripple-y": `${state.y}px`,
  } as CSSProperties;
  const className = [
    "navigation-ripple",
    `is-${state.phase}`,
    paused ? "is-paused" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      aria-hidden="true"
      className={className}
      data-navigation-ripple
      data-phase={state.phase}
      style={style}
    >
      <span className="navigation-ripple-origin" />
      <span className="navigation-ripple-wave" />
      <span className="navigation-ripple-wave" />
      <span className="navigation-ripple-wave" />
    </div>
  );
}

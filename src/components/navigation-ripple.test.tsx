import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getNavigationRippleOrigin,
  isPlainNavigationActivation,
  isSameNavigationTarget,
  NAVIGATION_RIPPLE_FADE_MS,
  NAVIGATION_RIPPLE_GIVE_UP_MS,
  NAVIGATION_RIPPLE_MIN_MS,
  NAVIGATION_RIPPLE_STALL_MS,
  shouldCancelNavigationRipple,
  shouldStartNavigationRipple,
  useNavigationRipple,
} from "@/components/navigation-ripple";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("navigation ripple intent", () => {
  it("distinguishes route identity from broader navigation highlighting", () => {
    expect(isSameNavigationTarget("/app/library", "/app/library")).toBe(true);
    expect(isSameNavigationTarget("/app/library/saved", "/app/library")).toBe(true);
    expect(isSameNavigationTarget("/app/topics/topic-1", "/app/library")).toBe(false);
  });

  it("accepts a normal navigation and rejects clicks the browser should own", () => {
    const normal = {
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      sameTarget: false,
      themeTransitionActive: false,
    };

    expect(isPlainNavigationActivation(normal)).toBe(true);
    expect(isPlainNavigationActivation({ ...normal, ctrlKey: true })).toBe(false);
    expect(shouldCancelNavigationRipple({ ...normal, sameTarget: true })).toBe(true);
    expect(shouldCancelNavigationRipple({ ...normal, sameTarget: true, ctrlKey: true })).toBe(false);
    expect(shouldCancelNavigationRipple(normal)).toBe(false);
    expect(shouldStartNavigationRipple(normal)).toBe(true);
    expect(shouldStartNavigationRipple({ ...normal, sameTarget: true })).toBe(false);
    expect(shouldStartNavigationRipple({ ...normal, ctrlKey: true })).toBe(false);
    expect(shouldStartNavigationRipple({ ...normal, button: 1 })).toBe(false);
    expect(shouldStartNavigationRipple({ ...normal, defaultPrevented: true })).toBe(false);
    expect(shouldStartNavigationRipple({ ...normal, themeTransitionActive: true })).toBe(false);
  });

  it("uses the pointer position and falls back to the control center for keyboard activation", () => {
    const currentTarget = {
      getBoundingClientRect: () => ({ left: 20, top: 30, width: 100, height: 40 }),
    };

    expect(getNavigationRippleOrigin({ clientX: 74, clientY: 91, detail: 1, currentTarget })).toEqual({ x: 74, y: 91 });
    expect(getNavigationRippleOrigin({ clientX: 0, clientY: 0, detail: 0, currentTarget })).toEqual({ x: 70, y: 50 });
  });
});

describe("useNavigationRipple", () => {
  it("keeps a minimum acknowledgement, then settles after any completed navigation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    const { result, rerender } = renderHook(
      ({ navigationKey }) => useNavigationRipple(navigationKey),
      { initialProps: { navigationKey: "path:/app/today" } },
    );

    act(() => result.current.begin({
      x: 40,
      y: 50,
      label: "Library",
      targetKey: "path:/app/library",
      reducedMotion: false,
    }));
    expect(result.current.ripple?.phase).toBe("rippling");
    expect(result.current.busy).toBe(true);

    act(() => vi.advanceTimersByTime(100));
    act(() => rerender({ navigationKey: "path:/login" }));
    expect(result.current.ripple?.contentCommitted).toBe(true);
    expect(result.current.busy).toBe(false);

    act(() => vi.advanceTimersByTime(NAVIGATION_RIPPLE_MIN_MS - 101));
    expect(result.current.ripple?.phase).toBe("rippling");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.ripple?.phase).toBe("settling");
    act(() => vi.advanceTimersByTime(NAVIGATION_RIPPLE_FADE_MS));
    expect(result.current.ripple).toBeNull();
  });

  it("supersedes an older ripple and restarts its timers at the new origin", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    const { result } = renderHook(() => useNavigationRipple("demo:today"));

    act(() => result.current.begin({ x: 10, y: 20, label: "Library", targetKey: "demo:library", reducedMotion: false }));
    const firstId = result.current.ripple?.id;
    act(() => vi.advanceTimersByTime(500));
    act(() => result.current.begin({ x: 90, y: 100, label: "Plan", targetKey: "demo:plan", reducedMotion: false }));

    expect(result.current.ripple).toMatchObject({ x: 90, y: 100, label: "Plan", targetKey: "demo:plan", phase: "rippling" });
    expect(result.current.ripple?.id).not.toBe(firstId);
    act(() => vi.advanceTimersByTime(NAVIGATION_RIPPLE_STALL_MS - 1));
    expect(result.current.ripple?.phase).toBe("rippling");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.ripple?.phase).toBe("stalled");
  });

  it("cancels obsolete pending feedback without letting old timers revive it", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    const { result } = renderHook(() => useNavigationRipple("path:/app/today"));

    act(() => result.current.begin({
      x: 30,
      y: 40,
      label: "Library",
      targetKey: "path:/app/library",
      reducedMotion: false,
    }));
    expect(result.current.busy).toBe(true);

    act(() => result.current.cancel());
    expect(result.current.ripple).toBeNull();
    expect(result.current.busy).toBe(false);

    act(() => vi.advanceTimersByTime(NAVIGATION_RIPPLE_GIVE_UP_MS + NAVIGATION_RIPPLE_FADE_MS));
    expect(result.current.ripple).toBeNull();
  });

  it("degrades to a static pending state and recovers when a late navigation completes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    const { result, rerender } = renderHook(
      ({ navigationKey }) => useNavigationRipple(navigationKey),
      { initialProps: { navigationKey: "path:/app/today" } },
    );

    act(() => result.current.begin({ x: 30, y: 40, label: "Activity", targetKey: "path:/app/activity", reducedMotion: false }));
    act(() => vi.advanceTimersByTime(NAVIGATION_RIPPLE_STALL_MS));
    expect(result.current.ripple?.phase).toBe("stalled");
    expect(result.current.busy).toBe(true);

    act(() => rerender({ navigationKey: "path:/app/activity" }));
    expect(result.current.ripple?.contentCommitted).toBe(true);
    expect(result.current.busy).toBe(false);
    act(() => vi.advanceTimersByTime(0));
    expect(result.current.ripple?.phase).toBe("settling");
    act(() => vi.advanceTimersByTime(NAVIGATION_RIPPLE_FADE_MS));
    expect(result.current.ripple).toBeNull();
  });

  it("releases aria-busy state when a stalled navigation never commits", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    const { result } = renderHook(() => useNavigationRipple("path:/app/today"));

    act(() => result.current.begin({
      x: 30,
      y: 40,
      label: "Library",
      targetKey: "path:/app/library",
      reducedMotion: false,
    }));
    act(() => vi.advanceTimersByTime(NAVIGATION_RIPPLE_STALL_MS));
    expect(result.current.ripple?.phase).toBe("stalled");
    expect(result.current.busy).toBe(true);

    act(() => vi.advanceTimersByTime(NAVIGATION_RIPPLE_GIVE_UP_MS - NAVIGATION_RIPPLE_STALL_MS));
    expect(result.current.ripple?.phase).toBe("settling");
    expect(result.current.busy).toBe(false);
    act(() => vi.advanceTimersByTime(NAVIGATION_RIPPLE_FADE_MS));
    expect(result.current.ripple).toBeNull();
  });

  it("uses a non-animated static phase for reduced motion", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-26T12:00:00.000Z"));
    const { result, rerender } = renderHook(
      ({ navigationKey }) => useNavigationRipple(navigationKey),
      { initialProps: { navigationKey: "demo:today" } },
    );

    act(() => result.current.begin({ x: 30, y: 40, label: "Library", targetKey: "demo:library", reducedMotion: true }));
    expect(result.current.ripple?.phase).toBe("static");
    act(() => rerender({ navigationKey: "demo:library" }));
    act(() => vi.advanceTimersByTime(NAVIGATION_RIPPLE_MIN_MS));
    expect(result.current.ripple?.phase).toBe("settling");
  });
});

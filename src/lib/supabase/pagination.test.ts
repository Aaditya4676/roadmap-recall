import { describe, expect, it, vi } from "vitest";
import { selectAllByOwner } from "@/lib/supabase/pagination";

describe("Supabase pagination", () => {
  it("continues past the default 1,000-row PostgREST page", async () => {
    const first = Array.from({ length: 1000 }, (_, id) => ({ id }));
    const second = Array.from({ length: 7 }, (_, offset) => ({ id: 1000 + offset }));
    const range = vi.fn(async (from: number) => ({ data: from === 0 ? first : second, error: null }));
    const db = { from: () => ({ select: () => ({ eq: () => ({ range }) }) }) } as any;
    const rows = await selectAllByOwner(db, "review_events", "owner");
    expect(rows).toHaveLength(1007);
    expect(range).toHaveBeenCalledTimes(2);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });
});

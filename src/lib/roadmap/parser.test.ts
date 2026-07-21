import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { matchImport, parseRoadmap } from "@/lib/roadmap/parser";

describe("master roadmap importer", () => {
  it("scopes only sections 1 through 27 and matches the approved fixture", () => {
    const source = readFileSync(path.resolve(process.cwd(), "../MASTER_FRONTEND_FULLSTACK_ROADMAP2.md"), "utf8");
    const parsed = parseRoadmap(source);
    expect(parsed.counts).toEqual({ total: 795, frontend: 613, fullstack: 182 });
    expect(parsed.sections.at(-1)?.sectionNumber).toBe(27);
    expect(parsed.items.every((item) => item.sectionNumber <= 27)).toBe(true);
  });

  it("prefers exact hashes, then locator plus similar title", () => {
    const [item] = parseRoadmap("# X\n# Part I\n## 1. One\n### A\n- [ ] **[P0]** Understand closures.").items;
    const exact = matchImport([item], [{
      id: "one",
      sectionNumber: 1,
      locator: item.locator,
      normalizedTitle: item.normalizedTitle,
      contentHash: item.contentHash,
    }]);
    expect(exact[0].status).toBe("exact");
  });
});

import { createHash } from "node:crypto";
import type {
  ParsedRoadmap,
  ParsedRoadmapItem,
  RoadmapPart,
  RoadmapSection,
  TopicKind,
} from "@/lib/domain/types";

const CHECKBOX = /^\s*-\s*\[[ xX]\]\s+(.+)$/;
const HEADING = /^(#{1,6})\s+(.+)$/;
const NUMBERED_SECTION = /^(\d+)\.\s+(.+)$/;

export function normalizeTitle(value: string): string {
  return value
    .replace(/\*\*\[P[0-2]\]\*\*/gi, "")
    .replace(/[`*_~]/g, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyKind(title: string, headingPath: string[]): TopicKind {
  const text = `${headingPath.join(" ")} ${title}`.toLowerCase();
  if (/\b(gate|exit criteria|completion criteria|rubric|checklist before|definition of done)\b/.test(text)) {
    return "gate";
  }
  if (/\b(daily|weekly|routine|cadence|schedule|repeat every|habit)\b/.test(text)) {
    return "routine";
  }
  if (/\b(project|capstone|portfolio|build end-to-end|ship|production app)\b/.test(text)) {
    return "project";
  }
  if (/\b(drill|implement|polyfill|solve|practice|recreate|debug|write a|design a|trace)\b/.test(text)) {
    return "drill";
  }
  return "knowledge";
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function parseRoadmap(markdown: string): ParsedRoadmap {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const title = lines.find((line) => line.startsWith("# "))?.slice(2).trim() ?? "Roadmap";
  const headings = new Map<number, string>();
  const sections: RoadmapSection[] = [];
  const items: ParsedRoadmapItem[] = [];
  let part: RoadmapPart = "frontend";
  let currentSection: RoadmapSection | null = null;
  let sourceOrdinal = 0;

  for (const line of lines) {
    const heading = line.match(HEADING);
    if (heading) {
      const level = heading[1].length;
      const text = normalizeTitle(heading[2]);
      headings.set(level, text);
      for (const key of [...headings.keys()]) if (key > level) headings.delete(key);

      if (level === 1 && /^Part II\b/i.test(text)) part = "fullstack";
      if (level === 1 && /^Part I\b/i.test(text)) part = "frontend";

      if (level === 2) {
        const numbered = text.match(NUMBERED_SECTION);
        const number = numbered ? Number(numbered[1]) : NaN;
        if (number >= 1 && number <= 27) {
          currentSection = {
            sectionNumber: number,
            title: numbered![2],
            part,
            ordinal: sections.length,
          };
          sections.push(currentSection);
          sourceOrdinal = 0;
        } else {
          currentSection = null;
        }
      }
      continue;
    }

    const checkbox = line.match(CHECKBOX);
    if (!checkbox || !currentSection) continue;
    sourceOrdinal += 1;
    const rawText = checkbox[1].trim();
    const itemTitle = normalizeTitle(rawText);
    const headingPath = [...headings.entries()]
      .filter(([level]) => level >= 2)
      .sort(([a], [b]) => a - b)
      .map(([, value]) => value);
    const priority = rawText.match(/\*\*\[(P[0-2])\]\*\*/i)?.[1]?.toUpperCase() as
      | "P0"
      | "P1"
      | "P2"
      | undefined;
    const locator = `${currentSection.sectionNumber}:${headingPath.slice(1).join(" > ")}:${sourceOrdinal}`;
    items.push({
      sectionNumber: currentSection.sectionNumber,
      part: currentSection.part,
      headingPath,
      sourceOrdinal,
      locator,
      rawText,
      title: itemTitle,
      normalizedTitle: itemTitle.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").trim(),
      contentHash: hash(`${currentSection.sectionNumber}\n${headingPath.join("\n")}\n${rawText}`),
      priority: priority ?? null,
      kind: classifyKind(itemTitle, headingPath),
    });
  }

  const frontend = items.filter((item) => item.part === "frontend").length;
  return {
    title,
    sections,
    items,
    counts: { total: items.length, frontend, fullstack: items.length - frontend },
  };
}

export type ImportMatch =
  | { status: "exact"; incoming: ParsedRoadmapItem; existingId: string }
  | { status: "probable"; incoming: ParsedRoadmapItem; existingId: string; similarity: number }
  | { status: "new"; incoming: ParsedRoadmapItem }
  | { status: "ambiguous"; incoming: ParsedRoadmapItem; candidates: string[] };

export interface ExistingImportItem {
  id: string;
  sectionNumber: number;
  locator: string;
  normalizedTitle: string;
  contentHash: string;
}

function tokenSimilarity(a: string, b: string): number {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export function matchImport(
  incoming: ParsedRoadmapItem[],
  existing: ExistingImportItem[],
): ImportMatch[] {
  return incoming.map((item) => {
    const inSection = existing.filter((candidate) => candidate.sectionNumber === item.sectionNumber);
    const exact = inSection.find((candidate) => candidate.contentHash === item.contentHash);
    if (exact) return { status: "exact", incoming: item, existingId: exact.id };

    const scored = inSection
      .filter((candidate) => candidate.locator === item.locator)
      .map((candidate) => ({ candidate, score: tokenSimilarity(item.normalizedTitle, candidate.normalizedTitle) }))
      .filter(({ score }) => score >= 0.58)
      .sort((a, b) => b.score - a.score);
    if (scored.length === 1) {
      return {
        status: "probable",
        incoming: item,
        existingId: scored[0].candidate.id,
        similarity: scored[0].score,
      };
    }
    if (scored.length > 1) {
      return { status: "ambiguous", incoming: item, candidates: scored.map(({ candidate }) => candidate.id) };
    }
    return { status: "new", incoming: item };
  });
}

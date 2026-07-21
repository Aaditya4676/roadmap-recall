import { describe, expect, it } from "vitest";
import { aiNoteDocumentSchema } from "@/lib/ai/schema";

describe("AI note contract", () => {
  const valid = { summary: "A summary", keyPoints: ["One"], pitfalls: [], recallQuestions: [], practiceIdeas: [], connections: [] };
  it("accepts the bounded document and strips no hidden personal-note field", () => {
    expect(aiNoteDocumentSchema.parse(valid)).toEqual(valid);
    expect(() => aiNoteDocumentSchema.parse({ ...valid, keyPoints: [] })).toThrow();
  });
  it("rejects oversized arrays", () => {
    expect(() => aiNoteDocumentSchema.parse({ ...valid, keyPoints: Array.from({ length: 13 }, (_, i) => String(i)) })).toThrow();
  });
});

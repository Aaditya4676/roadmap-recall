import type { Card } from "ts-fsrs";

// Stable database/import values retained for backward compatibility. Product
// UI maps these to the subject-neutral "Primary plan" and "Extension plan".
export type RoadmapPart = "frontend" | "fullstack";
export type TopicKind = "knowledge" | "drill" | "project" | "gate" | "routine";
export type SchedulerKind = "fsrs" | "fixed";
export type ReviewRating = "again" | "hard" | "good" | "easy";
export type FixedRating = Exclude<ReviewRating, "easy">;
export type KeepWarmDays = 14 | 30 | 60 | null;

export interface RoadmapSection {
  sectionNumber: number;
  title: string;
  part: RoadmapPart;
  ordinal: number;
}

export interface ParsedRoadmapItem {
  sectionNumber: number;
  part: RoadmapPart;
  headingPath: string[];
  sourceOrdinal: number;
  locator: string;
  rawText: string;
  title: string;
  normalizedTitle: string;
  contentHash: string;
  priority: "P0" | "P1" | "P2" | null;
  kind: TopicKind;
}

export interface ParsedRoadmap {
  title: string;
  sections: RoadmapSection[];
  items: ParsedRoadmapItem[];
  counts: {
    total: number;
    frontend: number;
    fullstack: number;
  };
}

export interface StudyTopic {
  id: string;
  title: string;
  breadcrumb: string;
  kind: TopicKind;
  part: RoadmapPart;
  learnedOn: string;
  activatedAt: string;
  scheduler: SchedulerKind;
  keepWarmDays: KeepWarmDays;
  note: PersonalNote;
  reviewState: ReviewState;
  aiNote?: AiNoteRecord;
}

export interface PersonalNote {
  markdown: string;
  revision: number;
  updatedAt: string;
}

export interface ReviewState {
  scheduler: SchedulerKind;
  dueAt: string;
  dueOn: string;
  lastReviewedAt: string | null;
  reviewCount: number;
  fixedStage: number;
  fsrsCard: SerializedCard | null;
}

export type SerializedCard = Omit<Card, "due" | "last_review"> & {
  due: string;
  last_review?: string;
};

export interface ReviewEvent {
  id: string;
  topicId: string;
  reviewedAt: string;
  reviewedOn: string;
  rating: ReviewRating;
  scheduler: SchedulerKind;
  previousDueOn: string;
  nextDueOn: string;
  scratchpad?: string;
}

export interface AiNoteDocument {
  summary: string;
  keyPoints: string[];
  mentalModel?: string;
  pitfalls: string[];
  recallQuestions: Array<{ question: string; answer?: string }>;
  practiceIdeas: string[];
  connections: string[];
  gapsOrUncertainties?: string[];
}

export interface AiNoteRecord {
  id: string;
  document: AiNoteDocument;
  revision: number;
  sourceNoteRevision: number;
  provider: "gemini" | "zai" | "external";
  model: string;
  createdAt: string;
  updatedAt: string;
  hidden: boolean;
}

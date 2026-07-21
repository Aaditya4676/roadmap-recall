import { env } from "@/lib/env";

export async function GET() {
  const base = env.APP_URL || "https://roadmap-recall.example.com";
  return Response.json({
    openapi: "3.1.0",
    info: { title: "Roadmap Recall AI Notes", version: "1.0.0", description: "A narrow, versioned API for adding separate AI learning notes. It cannot mutate personal notes or review state." },
    servers: [{ url: base }],
    components: {
      securitySchemes: { aiActionKey: { type: "http", scheme: "bearer" } },
      schemas: {
        AiNote: {
          type: "object", required: ["summary", "keyPoints", "pitfalls", "recallQuestions", "practiceIdeas", "connections"],
          properties: {
            summary: { type: "string" }, keyPoints: { type: "array", items: { type: "string" } }, mentalModel: { type: "string" },
            pitfalls: { type: "array", items: { type: "string" } }, recallQuestions: { type: "array", items: { type: "object", required: ["question"], properties: { question: { type: "string" }, answer: { type: "string" } } } },
            practiceIdeas: { type: "array", items: { type: "string" } }, connections: { type: "array", items: { type: "string" } }, gapsOrUncertainties: { type: "array", items: { type: "string" } },
          },
        },
        AiNoteUpsert: {
          type: "object", required: ["expectedRevision", "sourceNoteRevision", "document", "model"], additionalProperties: false,
          properties: { expectedRevision: { type: "integer", minimum: 0 }, sourceNoteRevision: { type: "integer", minimum: 1 }, document: { "$ref": "#/components/schemas/AiNote" }, model: { type: "string", maxLength: 120 } },
        },
        AiNoteBatchItem: {
          type: "object", required: ["topicId", "expectedRevision", "sourceNoteRevision", "document", "model"], additionalProperties: false,
          properties: { topicId: { type: "string", format: "uuid" }, expectedRevision: { type: "integer", minimum: 0 }, sourceNoteRevision: { type: "integer", minimum: 1 }, document: { "$ref": "#/components/schemas/AiNote" }, model: { type: "string", maxLength: 120 } },
        },
      },
    },
    security: [{ aiActionKey: [] }],
    paths: {
      "/api/ai/v1/work-queue": { get: { operationId: "getAiNoteWorkQueue", summary: "List topics with missing or stale AI notes", parameters: [{ name: "state", in: "query", schema: { type: "string", default: "missing,stale" } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 5, default: 5 } }, { name: "cursor", in: "query", schema: { type: "string" } }], responses: { "200": { description: "Metadata-only queue" } } } },
      "/api/ai/v1/topics/{id}/context": { get: { operationId: "getTopicContext", summary: "Read one topic context, with consent-aware note pagination", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }, { name: "cursor", in: "query", schema: { type: "string" } }], responses: { "200": { description: "One topic context" } } } },
      "/api/ai/v1/topics/{id}/notes": { put: { operationId: "putAiNote", summary: "Versioned upsert of a separate AI note", "x-openai-isConsequential": false, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }], requestBody: { required: true, content: { "application/json": { schema: { "$ref": "#/components/schemas/AiNoteUpsert" } } } }, responses: { "200": { description: "Saved" }, "409": { description: "Revision conflict" } } } },
      "/api/ai/v1/notes/batch": { post: { operationId: "putAiNotesBatch", summary: "Transactionally upsert one to three AI notes", "x-openai-isConsequential": false, requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["notes"], additionalProperties: false, properties: { notes: { type: "array", minItems: 1, maxItems: 3, items: { "$ref": "#/components/schemas/AiNoteBatchItem" } } } } } } }, responses: { "200": { description: "All notes saved" }, "409": { description: "Nothing saved" } } } },
    },
  });
}

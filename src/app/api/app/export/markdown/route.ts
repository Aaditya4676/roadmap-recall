import { NextRequest } from "next/server";
import JSZip from "jszip";
import { errorResponse, requireOwnerRequest } from "@/lib/auth";
import { getTopics } from "@/lib/data";

function safeName(value: string) { return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").replace(/\s+/g, " ").slice(0, 100).trim(); }
function aiMarkdown(topic: Awaited<ReturnType<typeof getTopics>>[number]) {
  if (!topic.aiNote) return "";
  const doc = topic.aiNote.document;
  return `\n\n---\n\n## AI notes\n\n> ${topic.aiNote.provider} · ${topic.aiNote.model} · AI revision ${topic.aiNote.revision}\n\n${doc.summary}\n\n### Key points\n\n${doc.keyPoints.map((item) => `- ${item}`).join("\n")}\n\n### Pitfalls\n\n${doc.pitfalls.map((item) => `- ${item}`).join("\n")}`;
}

export async function GET(request: NextRequest) {
  try {
    const { db, user } = await requireOwnerRequest(request);
    const topics = await getTopics(db, user.id);
    const zip = new JSZip();
    zip.file("README.md", `# Roadmap Recall export\n\nExported ${new Date().toISOString()}. Personal notes and AI notes are labelled separately.\n`);
    for (const topic of topics) {
      const folder = topic.part === "frontend" ? "primary-plan" : "extension-plan";
      zip.file(`${folder}/${safeName(topic.title)}--${topic.id.slice(0, 8)}.md`, `# ${topic.title}\n\n- Learning plan: ${topic.breadcrumb}\n- Learned: ${topic.learnedOn}\n- Next review: ${topic.reviewState.dueOn}\n- Scheduler: ${topic.scheduler}\n\n## My notes\n\n${topic.note.markdown || "_No personal note._"}${aiMarkdown(topic)}\n`);
    }
    const content = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 } });
    return new Response(content as BodyInit, { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="roadmap-recall-markdown-${new Date().toISOString().slice(0, 10)}.zip"`, "cache-control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

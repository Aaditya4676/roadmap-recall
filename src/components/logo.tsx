import { Layers3 } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-bold tracking-[-0.02em]">
      <span className="grid size-8 place-items-center text-[var(--accent)]"><Layers3 size={20} strokeWidth={2.25} /></span>
      {!compact && <span>Roadmap Recall</span>}
    </span>
  );
}

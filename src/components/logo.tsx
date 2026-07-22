import { Layers3 } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-bold tracking-[-0.02em]">
      <span className="grid size-8 place-items-center rounded-md border border-[var(--glass-line-low)] bg-[var(--glass-control)] text-[var(--accent)] shadow-[inset_0_1px_0_var(--glass-line)]"><Layers3 size={19} strokeWidth={2.25} /></span>
      {!compact && <span>Roadmap Recall</span>}
    </span>
  );
}

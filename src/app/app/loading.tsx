import { LoaderCircle } from "lucide-react";

export default function AppLoading() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center gap-2 text-sm font-semibold text-[var(--muted)]" role="status" aria-live="polite">
      <LoaderCircle className="animate-spin" size={18} aria-hidden />
      Loading
    </div>
  );
}

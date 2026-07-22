import Link from "next/link";

export default function TopicNotFound() { return <div className="liquid-panel mx-auto max-w-lg rounded-[12px] p-8 text-center" data-liquid><h1 className="text-2xl font-bold">Topic not found</h1><p className="mt-2 text-[var(--muted)]">It may have been archived or the link belongs to a different account.</p><Link className="button-primary mt-6" data-liquid href="/app/today">Return to Today</Link></div>; }

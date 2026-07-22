import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <header className="public-chrome liquid-chrome" data-liquid>
        <div className="mx-auto flex h-18 max-w-4xl items-center justify-between px-5 sm:px-8">
          <Link href="/"><Logo /></Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <article className="content-surface p-6 sm:p-9">
          <p className="eyebrow">Privacy</p>
          <h1 className="mt-2 text-4xl font-bold">Small, explicit data boundaries</h1>
          <div className="markdown mt-7">
            <h2>Private workspace</h2>
            <p>Personal notes, review history, settings, and AI notes are stored in the owner&apos;s Supabase project. Row-level security restricts browser access to that owner.</p>
            <h2>AI use</h2>
            <p>AI is optional. In-app generation sends topic metadata and, only when checked for that request, personal note text to the selected provider. The Custom GPT Action receives personal note text only if the owner enables consent in Settings. AI endpoints can create or replace only the separate AI-note document; they have no personal-note write route.</p>
            <h2>Public demo</h2>
            <p>The demo stores its curated sandbox and your changes in localStorage in your browser. It does not connect to the production database.</p>
            <h2>Email and backups</h2>
            <p>Reminder emails contain topic titles, counts, an estimate, and an app link—never note contents. Weekly backup emails contain only AES-256-GCM ciphertext; the recovery key is kept separately.</p>
            <h2>Third parties</h2>
            <p>Depending on configuration, the app uses Supabase, Vercel, Resend, Google Gemini, or Z.AI. Their own terms and data policies apply when those services are enabled.</p>
          </div>
        </article>
      </main>
    </div>
  );
}

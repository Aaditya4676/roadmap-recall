# Roadmap Recall

A subject-neutral learning and spaced-revision companion. The included importer is currently configured for the 795 scoped checklist items in `MASTER_FRONTEND_FULLSTACK_ROADMAP2.md`, but manual topics, review scheduling, notes, AI support, and progress tracking are domain-independent.

The database retains the original `frontend` / `fullstack` part values as a backward-compatible storage contract. The product maps them to the neutral labels **Primary plan** / **Extension plan**; existing imports and backups therefore require no destructive migration.

The public `/demo` is a real localStorage sandbox. The private `/app/*` workspace uses Supabase Auth, Postgres, and RLS. Personal notes and optional AI notes are separate data models and separate API capabilities.

## What is implemented

- Calm Today queue with owner-calendar due dates, overdue carry-forward, a two-minute estimate, and a collapsed preview.
- Roadmap importer for numbered sections 1–27 with stable UUIDs, source hashes, locator/similarity matching, classification, preview gates, and non-destructive reimports.
- Fast learning capture, Markdown notes, local draft recovery, monotonic revisions, and conflict responses.
- FSRS (90% desired retention, one-year cap) and a transparent fixed 1d → 7d → 30d → maintenance scheduler.
- Active-recall review flow with hidden notes, scratchpad, optional append, separate AI reveal, and rating.
- Explicit replay-based scheduler migration with an audit event.
- Optional Gemini and Z.AI generation with structured output, one schema-repair retry, visible provider errors, and no silent fallback.
- Custom GPT Action boundary with metadata queue, consent-aware paginated context, revisioned AI-note upserts, transactional batches of up to three, timing-safe credentials, DB rate limits, and audit records.
- Daily due-only Resend reminders and weekly gzip + AES-256-GCM encrypted email backups.
- Versioned JSON, human-readable Markdown ZIP, backup inspection/decryption, and no-write restore validation.
- Responsive warm-neutral UI, dark mode, keyboard focus, reduced-motion support, mobile bottom navigation, and public demo isolation.

## Run locally

Requirements: Node 20.19+ or Node 22.13+ (Node 22 LTS recommended).

```powershell
git clone https://github.com/Aaditya4676/roadmap-recall.git
cd roadmap-recall
npm install
npm run dev
```

Open `http://localhost:3000/demo`; no credentials are required.

For the private workspace:

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill the public Supabase URL/key, service-role key, `OWNER_EMAIL`, and `APP_URL`.
3. Apply every SQL file in `supabase/migrations` in numeric order (or use the Supabase CLI).
4. In Supabase Auth, create and confirm exactly one user with the same address as `OWNER_EMAIL`, then disable open public signup.
5. Set the Auth Site URL/redirect URL and configure Resend as custom SMTP. Supabase’s demo SMTP is not suitable for this app.
6. Sign in once with that owner email, then preview and apply the roadmap:

```powershell
npm run roadmap:preview
npm run roadmap:import
```

The preview must report exactly 795 / 613 / 182. Apply aborts on ambiguity and never deletes activated study state.

## AI configuration

Set `GEMINI_API_KEY` (default provider) and/or `ZAI_API_KEY`. Selection is explicit; one provider never silently falls back to another. API keys remain server-only. Before including a personal note, the UI shows the exact opt-in checkbox and an unpaid-Gemini content warning.

For a private Custom GPT Action:

1. Generate a 32+ byte random `AI_ACTION_TOKEN` and deploy it as a server secret.
2. Import `https://YOUR_APP/openapi.json` into the GPT Action.
3. Configure API-key authentication as `Bearer AI_ACTION_TOKEN`.
4. Keep the GPT private. Ask it to pull `/work-queue`, read one topic at a time, then write the separate AI note with both expected revisions.
5. Enable personal-note sharing in Settings only if wanted. With consent off, context contains metadata only.

No Action route exists for personal-note writes, topic deletion, scheduling, review state, or settings. The versioned AI PUT/batch operations are marked non-consequential because they are reversible and conflict-checked.

## Reminders and backups

Set `RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET`, and a base64-encoded 32-byte `BACKUP_ENCRYPTION_KEY`. Generate the key once, keep it in a password manager, and never store it in Supabase or the backup email. Set a human-readable `BACKUP_KEY_ID` so future key rotation remains recoverable.

Vercel schedules reminders around 08:00 Asia/Kolkata (`02:30 UTC`) and weekly backups on Sunday. Hobby cron execution can occur anywhere within the scheduled hour, so the database delivery claims provide the real idempotency. Reminder emails are skipped when nothing is due and never contain note contents.

Inspect an encrypted attachment without printing note contents:

```powershell
$env:BACKUP_ENCRYPTION_KEY="..."
npm run backup:inspect -- .\roadmap-recall-2026-07-20.json.enc
```

Settings can dry-run a plaintext JSON restore export. Applying a restore is intentionally an operator-controlled follow-up, not a one-click destructive browser action.

## Verification

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The SQL policy assertions live in `supabase/tests/rls.sql`. Run them against a disposable/local Supabase database after migrations.

## Deployment

Deploy the `roadmap-recall` directory to Vercel, add all environment values there, and keep the Supabase service role, AI provider keys, AI Action token, cron secret, and backup key server-only. Vercel Hobby is intended for personal/non-commercial deployments; revisit the plan if the project becomes commercial. Supabase Free can pause inactive projects and has no managed backups, which is why the app sends its own encrypted weekly snapshot.

The public demo has no database client and makes no production writes. Use it as the portfolio link; keep `/app` and the Custom GPT private.

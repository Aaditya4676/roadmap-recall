-- Roadmap Recall: owner-scoped catalog, study state, review history and AI audit.
-- Apply with `supabase db push` or paste into the Supabase SQL editor once.

create extension if not exists pgcrypto;

create type public.roadmap_part as enum ('frontend', 'fullstack');
create type public.topic_kind as enum ('knowledge', 'drill', 'project', 'gate', 'routine');
create type public.scheduler_kind as enum ('fsrs', 'fixed');
create type public.review_rating as enum ('again', 'hard', 'good', 'easy');
create type public.import_status as enum ('preview', 'applied', 'failed');
create type public.ai_provider as enum ('gemini', 'zai', 'external');
create type public.attempt_status as enum ('started', 'succeeded', 'failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  time_zone text not null default 'Asia/Kolkata',
  default_scheduler public.scheduler_kind not null default 'fsrs',
  default_keep_warm_days smallint check (default_keep_warm_days in (14, 30, 60)),
  reminder_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roadmap_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  source_sha256 text not null,
  status public.import_status not null default 'preview',
  item_count integer not null,
  frontend_count integer not null,
  fullstack_count integer not null,
  preview jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create table public.roadmap_sections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  import_id uuid references public.roadmap_imports(id) on delete set null,
  section_number smallint not null check (section_number between 1 and 27),
  title text not null,
  part public.roadmap_part not null,
  source_ordinal integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, section_number)
);

create table public.roadmap_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  section_id uuid not null references public.roadmap_sections(id) on delete cascade,
  import_id uuid references public.roadmap_imports(id) on delete set null,
  heading_path text[] not null default '{}',
  source_ordinal integer not null,
  source_locator text not null,
  title text not null,
  normalized_title text not null,
  raw_text text not null,
  content_hash text not null,
  priority text check (priority in ('P0', 'P1', 'P2')),
  kind public.topic_kind not null default 'knowledge',
  active boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, source_locator)
);

create table public.study_topics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  roadmap_item_id uuid references public.roadmap_items(id) on delete set null,
  title text not null,
  breadcrumb text not null default 'Personal topics',
  kind public.topic_kind not null default 'knowledge',
  part public.roadmap_part not null default 'frontend',
  learned_on date not null,
  activated_at timestamptz not null default now(),
  scheduler public.scheduler_kind not null,
  keep_warm_days smallint check (keep_warm_days in (14, 30, 60)),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, roadmap_item_id)
);

create table public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null unique references public.study_topics(id) on delete cascade,
  markdown text not null default '',
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.review_states (
  topic_id uuid primary key references public.study_topics(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  scheduler public.scheduler_kind not null,
  due_at timestamptz not null,
  due_on date not null,
  last_reviewed_at timestamptz,
  review_count integer not null default 0,
  fixed_stage integer not null default 0,
  fsrs_card jsonb,
  updated_at timestamptz not null default now()
);

create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.study_topics(id) on delete cascade,
  reviewed_at timestamptz not null,
  rating public.review_rating not null,
  scheduler public.scheduler_kind not null,
  previous_due_on date not null,
  next_due_on date not null,
  scratchpad text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null unique references public.study_topics(id) on delete cascade,
  document jsonb not null,
  revision integer not null default 1 check (revision > 0),
  source_note_revision integer not null check (source_note_revision > 0),
  provider public.ai_provider not null,
  model text not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_note_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.study_topics(id) on delete cascade,
  ai_note_id uuid references public.ai_notes(id) on delete set null,
  document jsonb not null,
  revision integer not null,
  source_note_revision integer not null,
  provider public.ai_provider not null,
  model text not null,
  replaced_at timestamptz not null default now()
);

create table public.ai_generation_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid references public.study_topics(id) on delete set null,
  provider public.ai_provider not null,
  model text not null,
  status public.attempt_status not null,
  source_note_revision integer,
  request_chars integer not null default 0,
  response_chars integer,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.ai_api_requests (
  id bigint generated always as identity primary key,
  token_fingerprint text not null,
  route text not null,
  succeeded boolean not null default false,
  status_code integer,
  requested_at timestamptz not null default now()
);

create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  delivery_on date not null,
  due_count integer not null,
  topic_ids uuid[] not null default '{}',
  provider_message_id text,
  status text not null check (status in ('sending', 'sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, delivery_on)
);

create table public.backup_deliveries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  backup_on date not null,
  schema_version integer not null,
  key_id text not null,
  sha256 text,
  provider_message_id text,
  status text not null check (status in ('building', 'sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (owner_id, backup_on)
);

create index review_states_owner_due_idx on public.review_states (owner_id, due_on);
create index roadmap_items_section_idx on public.roadmap_items (section_id, source_ordinal);
create index review_events_topic_idx on public.review_events (topic_id, reviewed_at);
create index ai_attempts_owner_started_idx on public.ai_generation_attempts (owner_id, started_at desc);
create index ai_requests_fingerprint_idx on public.ai_api_requests (token_fingerprint, requested_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger sections_touch before update on public.roadmap_sections
for each row execute function public.touch_updated_at();
create trigger items_touch before update on public.roadmap_items
for each row execute function public.touch_updated_at();
create trigger topics_touch before update on public.study_topics
for each row execute function public.touch_updated_at();
create trigger notes_touch before update on public.personal_notes
for each row execute function public.touch_updated_at();
create trigger states_touch before update on public.review_states
for each row execute function public.touch_updated_at();
create trigger ai_notes_touch before update on public.ai_notes
for each row execute function public.touch_updated_at();
create trigger reminder_deliveries_touch before update on public.reminder_deliveries
for each row execute function public.touch_updated_at();
create trigger backup_deliveries_touch before update on public.backup_deliveries
for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger security definer set search_path = public language plpgsql as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

-- Authenticated users can only access their own rows. The service-role client is
-- reserved for cron and the narrowly scoped AI Action handlers, and bypasses RLS.
alter table public.profiles enable row level security;
alter table public.roadmap_imports enable row level security;
alter table public.roadmap_sections enable row level security;
alter table public.roadmap_items enable row level security;
alter table public.study_topics enable row level security;
alter table public.personal_notes enable row level security;
alter table public.review_states enable row level security;
alter table public.review_events enable row level security;
alter table public.ai_notes enable row level security;
alter table public.ai_note_versions enable row level security;
alter table public.ai_generation_attempts enable row level security;
alter table public.ai_api_requests enable row level security;
alter table public.reminder_deliveries enable row level security;
alter table public.backup_deliveries enable row level security;

create policy profiles_owner_all on public.profiles
for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'roadmap_imports', 'roadmap_sections', 'roadmap_items', 'study_topics',
    'personal_notes', 'review_states', 'review_events', 'ai_notes',
    'ai_note_versions', 'ai_generation_attempts', 'reminder_deliveries',
    'backup_deliveries'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
      table_name || '_owner_all', table_name
    );
  end loop;
end $$;

-- ai_api_requests deliberately has no authenticated policy: only service-role
-- server code can inspect or write rate-limit/audit records.

revoke all on public.ai_api_requests from anon, authenticated;
revoke all on public.ai_note_versions from anon;
revoke all on public.personal_notes from anon;

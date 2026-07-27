-- AI judgments are optional audit data attached to immutable answer snapshots.
-- Historical ratings may only be corrected through the narrowly scoped RPC
-- below, which also replaces the current scheduler state in one transaction.
alter table public.review_events
add column ai_assessment jsonb,
add column ai_judged_at timestamptz,
add column original_rating public.review_rating;

alter table public.review_events
add constraint review_events_ai_assessment_object check (
  ai_assessment is null or jsonb_typeof(ai_assessment) = 'object'
),
add constraint review_events_ai_judgment_pair check (
  (ai_assessment is null and ai_judged_at is null)
  or (ai_assessment is not null and ai_judged_at is not null)
);

create or replace function public.attach_new_review_ai_assessment(
  p_topic_id uuid,
  p_reviewed_at timestamptz,
  p_ai_assessment jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := auth.uid();
  target_event_id uuid;
begin
  if owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_ai_assessment is null or jsonb_typeof(p_ai_assessment) <> 'object' then
    raise exception 'Invalid AI assessment' using errcode = '22023';
  end if;
  select id into target_event_id
  from public.review_events
  where owner_id = owner
    and topic_id = p_topic_id
    and reviewed_at = p_reviewed_at
    and ai_assessment is null
  order by created_at desc, id desc
  limit 1
  for update;
  if target_event_id is null then
    raise exception 'Recorded review was not found' using errcode = '40001';
  end if;
  update public.review_events set
    ai_assessment = p_ai_assessment,
    ai_judged_at = now()
  where id = target_event_id and owner_id = owner;
end;
$$;

revoke all on function public.attach_new_review_ai_assessment(uuid, timestamptz, jsonb) from public, anon;
grant execute on function public.attach_new_review_ai_assessment(uuid, timestamptz, jsonb) to authenticated;

create or replace function public.record_topic_review_v3(
  p_topic_id uuid,
  p_expected_review_count integer,
  p_rating public.review_rating,
  p_reviewed_at timestamptz,
  p_previous_due_on date,
  p_next_state jsonb,
  p_scratchpad text,
  p_append_scratchpad boolean,
  p_recall_answers jsonb,
  p_ai_assessment jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner uuid := auth.uid();
begin
  if owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_ai_assessment is not null and jsonb_typeof(p_ai_assessment) <> 'object' then
    raise exception 'Invalid AI assessment' using errcode = '22023';
  end if;

  perform public.record_topic_review_v2(
    p_topic_id, p_expected_review_count, p_rating, p_reviewed_at,
    p_previous_due_on, p_next_state, p_scratchpad, p_append_scratchpad,
    p_recall_answers
  );

  if p_ai_assessment is not null then
    perform public.attach_new_review_ai_assessment(p_topic_id, p_reviewed_at, p_ai_assessment);
  end if;
end;
$$;

revoke all on function public.record_topic_review_v3(
  uuid, integer, public.review_rating, timestamptz, date, jsonb, text, boolean, jsonb, jsonb
) from public, anon;
grant execute on function public.record_topic_review_v3(
  uuid, integer, public.review_rating, timestamptz, date, jsonb, text, boolean, jsonb, jsonb
) to authenticated;

create or replace function public.apply_review_ai_judgment(
  p_event_id uuid,
  p_expected_review_count integer,
  p_rating public.review_rating,
  p_ai_assessment jsonb,
  p_next_state jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := auth.uid();
  event_topic_id uuid;
  event_rating public.review_rating;
  existing_assessment jsonb;
begin
  if owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_ai_assessment is null or jsonb_typeof(p_ai_assessment) <> 'object' then
    raise exception 'Invalid AI assessment' using errcode = '22023';
  end if;
  if (p_next_state ->> 'reviewCount')::integer <> p_expected_review_count then
    raise exception 'Invalid replayed review count' using errcode = '22023';
  end if;

  select topic_id, rating, ai_assessment
  into event_topic_id, event_rating, existing_assessment
  from public.review_events
  where id = p_event_id and owner_id = owner
  for update;

  if event_topic_id is null then
    raise exception 'Review event not found' using errcode = 'P0002';
  end if;
  if existing_assessment is not null then
    raise exception 'Review already has an AI judgment' using errcode = '40001';
  end if;

  if p_rating <> event_rating then
    update public.review_states set
      scheduler = (p_next_state ->> 'scheduler')::public.scheduler_kind,
      due_at = (p_next_state ->> 'dueAt')::timestamptz,
      due_on = (p_next_state ->> 'dueOn')::date,
      last_reviewed_at = (p_next_state ->> 'lastReviewedAt')::timestamptz,
      review_count = (p_next_state ->> 'reviewCount')::integer,
      fixed_stage = (p_next_state ->> 'fixedStage')::integer,
      fsrs_card = p_next_state -> 'fsrsCard',
      latest_recall_answers = p_next_state -> 'latestRecallAnswers'
    where topic_id = event_topic_id
      and owner_id = owner
      and review_count = p_expected_review_count;

    if not found then
      raise exception 'Review state changed; retry the AI judgment' using errcode = '40001';
    end if;
  end if;

  update public.review_events set
    original_rating = case when p_rating <> event_rating then event_rating else null end,
    rating = p_rating,
    ai_assessment = p_ai_assessment,
    ai_judged_at = now()
  where id = p_event_id and owner_id = owner and ai_assessment is null;

  if not found then
    raise exception 'Review already has an AI judgment' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.apply_review_ai_judgment(
  uuid, integer, public.review_rating, jsonb, jsonb
) from public, anon;
grant execute on function public.apply_review_ai_judgment(
  uuid, integer, public.review_rating, jsonb, jsonb
) to authenticated;

-- Cost-control ledger. Non-owner accounts claim at most five judgments in a
-- rolling 24-hour window. Failed calls remain counted because the
-- upstream provider may still have charged for them.
create table public.ai_recall_judgment_attempts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid references public.study_topics(id) on delete set null,
  review_event_id uuid references public.review_events(id) on delete set null,
  provider public.ai_provider not null,
  model text not null,
  status text not null default 'started' check (status in ('started', 'succeeded', 'failed')),
  error_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index ai_recall_judgment_attempts_owner_started_idx
on public.ai_recall_judgment_attempts (owner_id, started_at desc);

alter table public.ai_recall_judgment_attempts enable row level security;
create policy ai_recall_judgment_attempts_owner_select
on public.ai_recall_judgment_attempts for select to authenticated
using (owner_id = auth.uid());

revoke all on public.ai_recall_judgment_attempts from public, anon;
grant select on public.ai_recall_judgment_attempts to authenticated;

create or replace function public.claim_ai_recall_judgment(
  p_topic_id uuid,
  p_review_event_id uuid,
  p_provider public.ai_provider,
  p_model text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := auth.uid();
  used integer;
  attempt_id uuid;
begin
  if owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_provider not in ('gemini', 'zai') or nullif(trim(p_model), '') is null then
    raise exception 'Invalid AI provider claim' using errcode = '22023';
  end if;
  if not exists (select 1 from public.study_topics where id = p_topic_id and owner_id = owner) then
    raise exception 'Topic not found' using errcode = 'P0002';
  end if;
  if p_review_event_id is not null and not exists (
    select 1 from public.review_events
    where id = p_review_event_id and topic_id = p_topic_id and owner_id = owner
  ) then
    raise exception 'Review event not found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(owner::text, 0));

  select count(*) into used
  from public.ai_recall_judgment_attempts
  where owner_id = owner
    and started_at > now() - interval '24 hours';
  if used >= 5 then
    raise exception 'Rolling AI review limit reached' using errcode = 'P0001';
  end if;

  insert into public.ai_recall_judgment_attempts (
    owner_id, topic_id, review_event_id, provider, model
  ) values (
    owner, p_topic_id, p_review_event_id, p_provider, p_model
  ) returning id into attempt_id;
  return attempt_id;
end;
$$;

revoke all on function public.claim_ai_recall_judgment(
  uuid, uuid, public.ai_provider, text
) from public, anon;
grant execute on function public.claim_ai_recall_judgment(
  uuid, uuid, public.ai_provider, text
) to authenticated;

create or replace function public.finish_ai_recall_judgment(
  p_attempt_id uuid,
  p_status text,
  p_error_code text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_status not in ('succeeded', 'failed') then
    raise exception 'Invalid attempt status' using errcode = '22023';
  end if;
  update public.ai_recall_judgment_attempts set
    status = p_status,
    error_code = left(p_error_code, 120),
    finished_at = now()
  where id = p_attempt_id and owner_id = auth.uid() and status = 'started';
end;
$$;

revoke all on function public.finish_ai_recall_judgment(uuid, text, text) from public, anon;
grant execute on function public.finish_ai_recall_judgment(uuid, text, text) to authenticated;

create or replace function public.get_ai_recall_judgment_usage()
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::integer
  from public.ai_recall_judgment_attempts as attempts
  where attempts.owner_id = auth.uid()
    and attempts.started_at > now() - interval '24 hours';
$$;

revoke all on function public.get_ai_recall_judgment_usage() from public, anon;
grant execute on function public.get_ai_recall_judgment_usage() to authenticated;

-- Structured recall keeps authored prompts versioned with the personal note,
-- every submitted attempt in immutable review history, and a fast latest
-- snapshot on the current review state.
alter table public.personal_notes
add column recall_questions jsonb not null default '[]'::jsonb;

alter table public.personal_notes
add constraint personal_notes_recall_questions_array
check (
  jsonb_typeof(recall_questions) = 'array'
  and jsonb_array_length(recall_questions) <= 50
);

alter table public.review_states
add column latest_recall_answers jsonb not null default '[]'::jsonb;

alter table public.review_states
add constraint review_states_latest_recall_answers_array
check (
  jsonb_typeof(latest_recall_answers) = 'array'
  and jsonb_array_length(latest_recall_answers) <= 50
);

alter table public.review_events
add column recall_answers jsonb not null default '[]'::jsonb;

alter table public.review_events
add constraint review_events_recall_answers_array
check (
  jsonb_typeof(recall_answers) = 'array'
  and jsonb_array_length(recall_answers) <= 50
);

create or replace function public.jsonb_array_has_unique_uuid_field(
  p_value jsonb,
  p_field text
) returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select case
    when jsonb_typeof(p_value) <> 'array' then false
    else
      not exists (
        select 1
        from jsonb_array_elements(p_value) as elements(item)
        where jsonb_typeof(item -> p_field) is distinct from 'string'
          or (item ->> p_field) !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )
      and (
        select count(*) = count(distinct lower(item ->> p_field))
        from jsonb_array_elements(p_value) as elements(item)
      )
  end;
$$;

revoke all on function public.jsonb_array_has_unique_uuid_field(jsonb, text)
from public, anon;
grant execute on function public.jsonb_array_has_unique_uuid_field(jsonb, text)
to authenticated, service_role;

alter table public.personal_notes
add constraint personal_notes_recall_question_ids
check (public.jsonb_array_has_unique_uuid_field(recall_questions, 'id'));

alter table public.review_states
add constraint review_states_latest_recall_answer_ids
check (public.jsonb_array_has_unique_uuid_field(latest_recall_answers, 'id'));

alter table public.review_events
add constraint review_events_recall_answer_ids
check (public.jsonb_array_has_unique_uuid_field(recall_answers, 'id'));

-- Review attempts are append-only. Owners may read their history and the
-- review RPC may insert it, but ordinary authenticated queries cannot rewrite
-- an earlier answer after a newer attempt becomes current.
drop policy if exists review_events_owner_all on public.review_events;
create policy review_events_owner_select on public.review_events
for select to authenticated
using (owner_id = auth.uid());
create policy review_events_owner_insert on public.review_events
for insert to authenticated
with check (owner_id = auth.uid());

-- The v2 activation RPC writes the initial Markdown and Q&A in the same
-- transaction. The original RPC remains available to an already-deployed v1.
create or replace function public.activate_study_topic_v2(
  p_roadmap_item_id uuid,
  p_title text,
  p_breadcrumb text,
  p_kind public.topic_kind,
  p_part public.roadmap_part,
  p_learned_on date,
  p_activated_at timestamptz,
  p_scheduler public.scheduler_kind,
  p_keep_warm_days smallint,
  p_due_at timestamptz,
  p_due_on date,
  p_fsrs_card jsonb,
  p_initial_markdown text,
  p_recall_questions jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid := auth.uid();
  topic_id uuid;
  questions jsonb := coalesce(p_recall_questions, '[]'::jsonb);
begin
  if owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_kind not in ('knowledge', 'drill') then
    raise exception 'Only knowledge and drill items can be scheduled';
  end if;
  if jsonb_typeof(questions) <> 'array' or jsonb_array_length(questions) > 50 then
    raise exception 'Invalid recall questions' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(questions) as elements(item)
    where jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item -> 'id') is distinct from 'string'
      or jsonb_typeof(item -> 'question') is distinct from 'string'
      or jsonb_typeof(item -> 'idealAnswer') is distinct from 'string'
      or length(item ->> 'question') > 2000
      or length(item ->> 'idealAnswer') > 12000
  ) then
    raise exception 'Invalid recall question shape' using errcode = '22023';
  end if;
  if (
    select coalesce(sum(length(item ->> 'question') + length(item ->> 'idealAnswer')), 0)
    from jsonb_array_elements(questions) as elements(item)
  ) > 100000 then
    raise exception 'Recall questions are too large' using errcode = '22023';
  end if;

  if p_roadmap_item_id is not null then
    select id into topic_id
    from public.study_topics
    where owner_id = owner and roadmap_item_id = p_roadmap_item_id;
    if topic_id is not null then return topic_id; end if;
  end if;

  insert into public.study_topics (
    owner_id, roadmap_item_id, title, breadcrumb, kind, part, learned_on,
    activated_at, scheduler, keep_warm_days
  ) values (
    owner, p_roadmap_item_id, p_title, p_breadcrumb, p_kind, p_part,
    p_learned_on, p_activated_at, p_scheduler, p_keep_warm_days
  ) returning id into topic_id;

  insert into public.personal_notes (
    owner_id, topic_id, markdown, recall_questions
  ) values (
    owner, topic_id, coalesce(p_initial_markdown, ''), questions
  );

  insert into public.review_states (
    owner_id, topic_id, scheduler, due_at, due_on, fsrs_card
  ) values (
    owner, topic_id, p_scheduler, p_due_at, p_due_on, p_fsrs_card
  );

  if p_roadmap_item_id is not null then
    update public.roadmap_items
    set active = true
    where id = p_roadmap_item_id and owner_id = owner;
  end if;
  return topic_id;
end;
$$;

revoke all on function public.activate_study_topic_v2(
  uuid, text, text, public.topic_kind, public.roadmap_part, date, timestamptz,
  public.scheduler_kind, smallint, timestamptz, date, jsonb, text, jsonb
) from public, anon;
grant execute on function public.activate_study_topic_v2(
  uuid, text, text, public.topic_kind, public.roadmap_part, date, timestamptz,
  public.scheduler_kind, smallint, timestamptz, date, jsonb, text, jsonb
) to authenticated;

-- Keep record_topic_review available during a rolling deployment. The v2 RPC
-- adds structured answers without breaking an already-open review on v1.
create or replace function public.record_topic_review_v2(
  p_topic_id uuid,
  p_expected_review_count integer,
  p_rating public.review_rating,
  p_reviewed_at timestamptz,
  p_previous_due_on date,
  p_next_state jsonb,
  p_scratchpad text,
  p_append_scratchpad boolean,
  p_recall_answers jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  owner uuid := auth.uid();
  owner_time_zone text;
  review_day date;
  answers jsonb := coalesce(p_recall_answers, '[]'::jsonb);
  questions jsonb;
begin
  if owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(answers) <> 'array' or jsonb_array_length(answers) > 50 then
    raise exception 'Invalid recall answers' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(answers) as elements(item)
    where jsonb_typeof(item) <> 'object'
      or jsonb_typeof(item -> 'id') is distinct from 'string'
      or jsonb_typeof(item -> 'question') is distinct from 'string'
      or jsonb_typeof(item -> 'idealAnswer') is distinct from 'string'
      or jsonb_typeof(item -> 'answer') is distinct from 'string'
      or length(item ->> 'question') > 2000
      or length(item ->> 'idealAnswer') > 12000
      or length(item ->> 'answer') > 12000
  ) then
    raise exception 'Invalid recall answer shape' using errcode = '22023';
  end if;
  if (
    select coalesce(sum(length(item ->> 'question') + length(item ->> 'idealAnswer')), 0)
    from jsonb_array_elements(answers) as elements(item)
  ) > 100000 or (
    select coalesce(sum(length(item ->> 'answer')), 0)
    from jsonb_array_elements(answers) as elements(item)
  ) > 100000 then
    raise exception 'Recall answers are too large' using errcode = '22023';
  end if;
  if length(coalesce(p_scratchpad, '')) > 20000 then
    raise exception 'Recall scratchpad is too large' using errcode = '22023';
  end if;

  -- Lock the authored questions until the review transaction commits. This
  -- prevents a note edit in another tab from pairing an answer with newer
  -- question text and makes the database enforce the same exact-set check as
  -- the application boundary.
  select recall_questions into questions
  from public.personal_notes
  where topic_id = p_topic_id and owner_id = owner
  for share;

  if not found then
    raise exception 'Personal note changed; reload before rating' using errcode = '40001';
  end if;

  if jsonb_array_length(answers) <> (
    select count(*)
    from jsonb_array_elements(questions) as elements(item)
    where nullif(trim(item ->> 'question'), '') is not null
      and nullif(trim(item ->> 'idealAnswer'), '') is not null
  ) or exists (
    select 1
    from jsonb_array_elements(answers) as submitted(answer)
    left join jsonb_array_elements(questions) as authored(question)
      on lower(authored.question ->> 'id') = lower(submitted.answer ->> 'id')
      and nullif(trim(authored.question ->> 'question'), '') is not null
      and nullif(trim(authored.question ->> 'idealAnswer'), '') is not null
    where authored.question is null
      or authored.question ->> 'question' is distinct from submitted.answer ->> 'question'
      or authored.question ->> 'idealAnswer' is distinct from submitted.answer ->> 'idealAnswer'
  ) then
    raise exception 'Recall questions changed; reload before rating' using errcode = '40001';
  end if;

  select time_zone into owner_time_zone
  from public.profiles
  where id = owner;

  if owner_time_zone is null then
    raise exception 'Owner profile not found' using errcode = '42501';
  end if;

  review_day := (p_reviewed_at at time zone owner_time_zone)::date;

  update public.review_states set
    scheduler = (p_next_state ->> 'scheduler')::public.scheduler_kind,
    due_at = (p_next_state ->> 'dueAt')::timestamptz,
    due_on = (p_next_state ->> 'dueOn')::date,
    last_reviewed_at = (p_next_state ->> 'lastReviewedAt')::timestamptz,
    review_count = (p_next_state ->> 'reviewCount')::integer,
    fixed_stage = (p_next_state ->> 'fixedStage')::integer,
    fsrs_card = p_next_state -> 'fsrsCard',
    latest_recall_answers = answers
  where topic_id = p_topic_id
    and owner_id = owner
    and review_count = p_expected_review_count;

  if not found then
    raise exception 'Review state changed; reload before rating' using errcode = '40001';
  end if;

  insert into public.review_events (
    owner_id, topic_id, reviewed_at, reviewed_on, rating, scheduler,
    previous_due_on, next_due_on, scratchpad, recall_answers
  ) values (
    owner, p_topic_id, p_reviewed_at, review_day, p_rating,
    (p_next_state ->> 'scheduler')::public.scheduler_kind, p_previous_due_on,
    (p_next_state ->> 'dueOn')::date, nullif(p_scratchpad, ''), answers
  );

  if p_append_scratchpad and nullif(trim(p_scratchpad), '') is not null then
    update public.personal_notes set
      markdown = markdown || E'\n\n### Recall note · ' || to_char(review_day, 'YYYY-MM-DD') || E'\n\n' || p_scratchpad,
      revision = revision + 1
    where topic_id = p_topic_id and owner_id = owner;
  end if;
end;
$$;

revoke all on function public.record_topic_review_v2(
  uuid, integer, public.review_rating, timestamptz, date, jsonb, text, boolean, jsonb
) from public, anon;
grant execute on function public.record_topic_review_v2(
  uuid, integer, public.review_rating, timestamptz, date, jsonb, text, boolean, jsonb
) to authenticated;

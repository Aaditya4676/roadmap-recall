-- Preserve the AI rubric mean as continuous scheduling evidence. NULL means
-- that a review used a manual or legacy four-button rating.
alter table public.review_events
add column continuous_grade double precision;

alter table public.review_events
add constraint review_events_continuous_grade_range check (
  continuous_grade is null
  or (continuous_grade >= 1 and continuous_grade <= 4 and continuous_grade <> 'NaN'::double precision)
);

create or replace function public.record_topic_review_v4(
  p_topic_id uuid,
  p_expected_review_count integer,
  p_rating public.review_rating,
  p_reviewed_at timestamptz,
  p_previous_due_on date,
  p_next_state jsonb,
  p_scratchpad text,
  p_append_scratchpad boolean,
  p_recall_answers jsonb,
  p_ai_assessment jsonb,
  p_continuous_grade double precision
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
  if (p_ai_assessment is null) <> (p_continuous_grade is null) then
    raise exception 'AI assessment and continuous grade must be supplied together' using errcode = '22023';
  end if;
  if p_continuous_grade is not null and (
    p_continuous_grade < 1 or p_continuous_grade > 4 or p_continuous_grade = 'NaN'::double precision
  ) then
    raise exception 'Invalid continuous grade' using errcode = '22023';
  end if;

  perform public.record_topic_review_v3(
    p_topic_id, p_expected_review_count, p_rating, p_reviewed_at,
    p_previous_due_on, p_next_state, p_scratchpad, p_append_scratchpad,
    p_recall_answers, p_ai_assessment
  );

  if p_continuous_grade is not null then
    update public.review_events set continuous_grade = p_continuous_grade
    where id = (
      select id from public.review_events
      where owner_id = owner
        and topic_id = p_topic_id
        and reviewed_at = p_reviewed_at
        and ai_assessment is not null
      order by created_at desc, id desc
      limit 1
    );
    if not found then
      raise exception 'Recorded review was not found' using errcode = '40001';
    end if;
  end if;
end;
$$;

revoke all on function public.record_topic_review_v4(
  uuid, integer, public.review_rating, timestamptz, date, jsonb, text, boolean, jsonb, jsonb, double precision
) from public, anon;
grant execute on function public.record_topic_review_v4(
  uuid, integer, public.review_rating, timestamptz, date, jsonb, text, boolean, jsonb, jsonb, double precision
) to authenticated;

create or replace function public.apply_review_ai_judgment_v2(
  p_event_id uuid,
  p_expected_review_count integer,
  p_rating public.review_rating,
  p_ai_assessment jsonb,
  p_continuous_grade double precision,
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
  if p_continuous_grade is null or p_continuous_grade < 1 or p_continuous_grade > 4 or p_continuous_grade = 'NaN'::double precision then
    raise exception 'Invalid continuous grade' using errcode = '22023';
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

  -- Continuous evidence can change the card even if both old and new labels
  -- say Good, so replace the replayed state unconditionally.
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

  update public.review_events set
    original_rating = case when p_rating <> event_rating then event_rating else null end,
    rating = p_rating,
    ai_assessment = p_ai_assessment,
    ai_judged_at = now(),
    continuous_grade = p_continuous_grade
  where id = p_event_id and owner_id = owner and ai_assessment is null;

  if not found then
    raise exception 'Review already has an AI judgment' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.apply_review_ai_judgment_v2(
  uuid, integer, public.review_rating, jsonb, double precision, jsonb
) from public, anon;
grant execute on function public.apply_review_ai_judgment_v2(
  uuid, integer, public.review_rating, jsonb, double precision, jsonb
) to authenticated;

create or replace function public.apply_existing_ai_continuous_grade(
  p_event_id uuid,
  p_expected_review_count integer,
  p_ai_assessment jsonb,
  p_continuous_grade double precision,
  p_next_state jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := auth.uid();
  event_topic_id uuid;
  existing_assessment jsonb;
  existing_grade double precision;
begin
  if owner is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_ai_assessment is null or jsonb_typeof(p_ai_assessment) <> 'object' then
    raise exception 'Invalid AI assessment' using errcode = '22023';
  end if;
  if p_continuous_grade is null or p_continuous_grade < 1 or p_continuous_grade > 4 or p_continuous_grade = 'NaN'::double precision then
    raise exception 'Invalid continuous grade' using errcode = '22023';
  end if;
  if (p_next_state ->> 'reviewCount')::integer <> p_expected_review_count then
    raise exception 'Invalid replayed review count' using errcode = '22023';
  end if;

  select topic_id, ai_assessment, continuous_grade
  into event_topic_id, existing_assessment, existing_grade
  from public.review_events
  where id = p_event_id and owner_id = owner
  for update;

  if event_topic_id is null then
    raise exception 'Review event not found' using errcode = 'P0002';
  end if;
  if existing_assessment is null or existing_grade is not null then
    raise exception 'Review is not eligible for continuous upgrade' using errcode = '40001';
  end if;

  update public.review_states set
    scheduler = (p_next_state ->> 'scheduler')::public.scheduler_kind,
    due_at = (p_next_state ->> 'dueAt')::timestamptz,
    due_on = (p_next_state ->> 'dueOn')::date,
    last_reviewed_at = (p_next_state ->> 'lastReviewedAt')::timestamptz,
    review_count = (p_next_state ->> 'reviewCount')::integer,
    fixed_stage = (p_next_state ->> 'fixedStage')::integer,
    fsrs_card = p_next_state -> 'fsrsCard',
    latest_recall_answers = p_next_state -> 'latestRecallAnswers'
  where topic_id = event_topic_id and owner_id = owner and review_count = p_expected_review_count;

  if not found then
    raise exception 'Review state changed; retry the upgrade' using errcode = '40001';
  end if;

  update public.review_events set
    ai_assessment = p_ai_assessment,
    continuous_grade = p_continuous_grade
  where id = p_event_id and owner_id = owner and continuous_grade is null;

  if not found then
    raise exception 'Review was already upgraded' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.apply_existing_ai_continuous_grade(
  uuid, integer, jsonb, double precision, jsonb
) from public, anon;
grant execute on function public.apply_existing_ai_continuous_grade(
  uuid, integer, jsonb, double precision, jsonb
) to authenticated;

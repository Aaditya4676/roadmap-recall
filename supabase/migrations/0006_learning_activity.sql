-- Freeze the owner's calendar date at review time. Historical rows use the
-- profile timezone that existed when this migration was applied; future rows
-- are written by record_topic_review and never shift after timezone changes.
alter table public.review_events
add column reviewed_on date;

update public.review_events as events
set reviewed_on = (events.reviewed_at at time zone profiles.time_zone)::date
from public.profiles as profiles
where profiles.id = events.owner_id;

alter table public.review_events
alter column reviewed_on set not null;

create index review_events_owner_reviewed_on_idx
on public.review_events (owner_id, reviewed_on);

create or replace function public.record_topic_review(
  p_topic_id uuid,
  p_expected_review_count integer,
  p_rating public.review_rating,
  p_reviewed_at timestamptz,
  p_previous_due_on date,
  p_next_state jsonb,
  p_scratchpad text,
  p_append_scratchpad boolean
) returns void language plpgsql as $$
declare
  owner uuid := auth.uid();
  owner_time_zone text;
  review_day date;
begin
  if owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;

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
    fsrs_card = p_next_state -> 'fsrsCard'
  where topic_id = p_topic_id and owner_id = owner and review_count = p_expected_review_count;

  if not found then raise exception 'Review state changed; reload before rating' using errcode = '40001'; end if;

  insert into public.review_events (
    owner_id, topic_id, reviewed_at, reviewed_on, rating, scheduler,
    previous_due_on, next_due_on, scratchpad
  ) values (
    owner, p_topic_id, p_reviewed_at, review_day, p_rating,
    (p_next_state ->> 'scheduler')::public.scheduler_kind, p_previous_due_on,
    (p_next_state ->> 'dueOn')::date, nullif(p_scratchpad, '')
  );

  if p_append_scratchpad and nullif(trim(p_scratchpad), '') is not null then
    update public.personal_notes set
      markdown = markdown || E'\n\n### Recall note · ' || to_char(review_day, 'YYYY-MM-DD') || E'\n\n' || p_scratchpad,
      revision = revision + 1
    where topic_id = p_topic_id and owner_id = owner;
  end if;
end;
$$;

-- Return only the event-shaped data needed to render a bounded activity
-- calendar. RLS still applies because this is a security-invoker function.
create or replace function public.get_learning_activity_events(
  p_from date,
  p_to date
) returns table (
  event_kind text,
  topic_id uuid,
  event_on date,
  previous_due_on date
) language plpgsql stable security invoker set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 400 then
    raise exception 'Activity range must contain at most 401 days' using errcode = '22023';
  end if;

  return query
    select
      'learned'::text,
      topics.id,
      topics.learned_on,
      null::date
    from public.study_topics as topics
    where topics.owner_id = auth.uid()
      and topics.learned_on between p_from and p_to

    union all

    select
      'reviewed'::text,
      events.topic_id,
      events.reviewed_on,
      events.previous_due_on
    from public.review_events as events
    where events.owner_id = auth.uid()
      and (
        events.reviewed_on between p_from and p_to
        or (
          events.previous_due_on between p_from and p_to
          and events.reviewed_on > events.previous_due_on
        )
      );
end;
$$;

revoke all on function public.get_learning_activity_events(date, date) from public, anon;
grant execute on function public.get_learning_activity_events(date, date) to authenticated;

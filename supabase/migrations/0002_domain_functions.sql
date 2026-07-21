alter table public.profiles
add column ai_action_share_personal_notes boolean not null default false;

create or replace function public.activate_study_topic(
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
  p_initial_markdown text
) returns uuid language plpgsql as $$
declare
  owner uuid := auth.uid();
  topic_id uuid;
begin
  if owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_kind not in ('knowledge', 'drill') then
    raise exception 'Only knowledge and drill items can be scheduled';
  end if;

  if p_roadmap_item_id is not null then
    select id into topic_id from public.study_topics
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

  insert into public.personal_notes (owner_id, topic_id, markdown)
  values (owner, topic_id, coalesce(p_initial_markdown, ''));

  insert into public.review_states (
    owner_id, topic_id, scheduler, due_at, due_on, fsrs_card
  ) values (
    owner, topic_id, p_scheduler, p_due_at, p_due_on, p_fsrs_card
  );

  if p_roadmap_item_id is not null then
    update public.roadmap_items set active = true
    where id = p_roadmap_item_id and owner_id = owner;
  end if;
  return topic_id;
end;
$$;

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
begin
  if owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;

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
    owner_id, topic_id, reviewed_at, rating, scheduler, previous_due_on,
    next_due_on, scratchpad
  ) values (
    owner, p_topic_id, p_reviewed_at, p_rating,
    (p_next_state ->> 'scheduler')::public.scheduler_kind, p_previous_due_on,
    (p_next_state ->> 'dueOn')::date, nullif(p_scratchpad, '')
  );

  if p_append_scratchpad and nullif(trim(p_scratchpad), '') is not null then
    update public.personal_notes set
      markdown = markdown || E'\n\n### Recall note · ' || to_char(p_reviewed_at at time zone 'UTC', 'YYYY-MM-DD') || E'\n\n' || p_scratchpad,
      revision = revision + 1
    where topic_id = p_topic_id and owner_id = owner;
  end if;
end;
$$;

grant execute on function public.activate_study_topic to authenticated;
grant execute on function public.record_topic_review to authenticated;

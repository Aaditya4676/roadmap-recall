create table public.scheduler_change_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  topic_id uuid not null references public.study_topics(id) on delete cascade,
  from_scheduler public.scheduler_kind not null,
  to_scheduler public.scheduler_kind not null,
  previous_state jsonb not null,
  next_state jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.scheduler_change_events enable row level security;
create policy scheduler_change_events_owner_all on public.scheduler_change_events
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.migrate_topic_scheduler(
  p_topic_id uuid,
  p_expected_review_count integer,
  p_next_state jsonb
) returns void language plpgsql as $$
declare
  owner uuid := auth.uid();
  prior public.review_states%rowtype;
begin
  if owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into prior from public.review_states
  where topic_id = p_topic_id and owner_id = owner and review_count = p_expected_review_count
  for update;
  if not found then raise exception 'Review state changed' using errcode = '40001'; end if;

  update public.review_states set
    scheduler = (p_next_state ->> 'scheduler')::public.scheduler_kind,
    due_at = (p_next_state ->> 'dueAt')::timestamptz,
    due_on = (p_next_state ->> 'dueOn')::date,
    last_reviewed_at = nullif(p_next_state ->> 'lastReviewedAt', '')::timestamptz,
    review_count = (p_next_state ->> 'reviewCount')::integer,
    fixed_stage = (p_next_state ->> 'fixedStage')::integer,
    fsrs_card = p_next_state -> 'fsrsCard'
  where topic_id = p_topic_id;

  update public.study_topics set scheduler = (p_next_state ->> 'scheduler')::public.scheduler_kind
  where id = p_topic_id and owner_id = owner;

  insert into public.scheduler_change_events (
    owner_id, topic_id, from_scheduler, to_scheduler, previous_state, next_state
  ) values (
    owner, p_topic_id, prior.scheduler, (p_next_state ->> 'scheduler')::public.scheduler_kind,
    to_jsonb(prior), p_next_state
  );
end;
$$;

grant execute on function public.migrate_topic_scheduler to authenticated;

create or replace function public.migrate_topic_schedulers_batch(
  p_items jsonb,
  p_default_scheduler public.scheduler_kind
) returns integer language plpgsql as $$
declare
  item jsonb;
  migrated integer := 0;
  owner uuid := auth.uid();
begin
  if owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 5000 then
    raise exception 'Invalid scheduler migration batch';
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    perform public.migrate_topic_scheduler(
      (item ->> 'topicId')::uuid,
      (item ->> 'expectedReviewCount')::integer,
      item -> 'nextState'
    );
    migrated := migrated + 1;
  end loop;

  update public.profiles set default_scheduler = p_default_scheduler where id = owner;
  return migrated;
end;
$$;

revoke all on function public.migrate_topic_schedulers_batch from public, anon;
grant execute on function public.migrate_topic_schedulers_batch to authenticated;

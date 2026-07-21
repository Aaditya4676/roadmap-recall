create or replace function public.upsert_ai_note_versioned(
  p_owner_id uuid,
  p_topic_id uuid,
  p_expected_revision integer,
  p_document jsonb,
  p_source_note_revision integer,
  p_provider public.ai_provider,
  p_model text
) returns public.ai_notes
security definer set search_path = public language plpgsql as $$
declare
  current_note public.ai_notes%rowtype;
  result public.ai_notes%rowtype;
  caller_role text := coalesce(auth.role(), '');
begin
  if caller_role <> 'service_role' and auth.uid() is distinct from p_owner_id then
    raise exception 'Not permitted' using errcode = '42501';
  end if;
  if not exists (select 1 from public.study_topics where id = p_topic_id and owner_id = p_owner_id) then
    raise exception 'Topic not found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.personal_notes
    where topic_id = p_topic_id and owner_id = p_owner_id and revision = p_source_note_revision
  ) then
    raise exception 'Personal note revision conflict' using errcode = '40001';
  end if;

  select * into current_note from public.ai_notes
  where owner_id = p_owner_id and topic_id = p_topic_id for update;

  if found then
    if current_note.revision <> p_expected_revision then
      raise exception 'AI note revision conflict' using errcode = '40001';
    end if;
    insert into public.ai_note_versions (
      owner_id, topic_id, ai_note_id, document, revision, source_note_revision,
      provider, model
    ) values (
      current_note.owner_id, current_note.topic_id, current_note.id,
      current_note.document, current_note.revision, current_note.source_note_revision,
      current_note.provider, current_note.model
    );
    update public.ai_notes set
      document = p_document,
      revision = current_note.revision + 1,
      source_note_revision = p_source_note_revision,
      provider = p_provider,
      model = p_model,
      hidden = false
    where id = current_note.id returning * into result;
  else
    if p_expected_revision <> 0 then
      raise exception 'AI note revision conflict' using errcode = '40001';
    end if;
    insert into public.ai_notes (
      owner_id, topic_id, document, source_note_revision, provider, model
    ) values (
      p_owner_id, p_topic_id, p_document, p_source_note_revision, p_provider, p_model
    ) returning * into result;
  end if;
  return result;
end;
$$;

create or replace function public.upsert_ai_notes_batch(p_items jsonb)
returns setof public.ai_notes
security definer set search_path = public language plpgsql as $$
declare item jsonb;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 3 then
    raise exception 'Batch must contain 1 to 3 notes';
  end if;
  for item in select * from jsonb_array_elements(p_items)
  loop
    return query select * from public.upsert_ai_note_versioned(
      (item ->> 'ownerId')::uuid,
      (item ->> 'topicId')::uuid,
      (item ->> 'expectedRevision')::integer,
      item -> 'document',
      (item ->> 'sourceNoteRevision')::integer,
      (item ->> 'provider')::public.ai_provider,
      item ->> 'model'
    );
  end loop;
end;
$$;

revoke all on function public.upsert_ai_note_versioned from public, anon;
revoke all on function public.upsert_ai_notes_batch from public, anon, authenticated;
grant execute on function public.upsert_ai_note_versioned to authenticated, service_role;
grant execute on function public.upsert_ai_notes_batch to service_role;

create or replace function public.discard_ai_note_versioned(
  p_topic_id uuid,
  p_expected_revision integer
) returns void language plpgsql as $$
declare
  owner uuid := auth.uid();
  current_note public.ai_notes%rowtype;
begin
  if owner is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into current_note from public.ai_notes
  where topic_id = p_topic_id and owner_id = owner for update;
  if not found then raise exception 'AI note not found' using errcode = 'P0002'; end if;
  if current_note.revision <> p_expected_revision then
    raise exception 'AI note revision conflict' using errcode = '40001';
  end if;

  insert into public.ai_note_versions (
    owner_id, topic_id, ai_note_id, document, revision, source_note_revision,
    provider, model
  ) values (
    current_note.owner_id, current_note.topic_id, current_note.id,
    current_note.document, current_note.revision, current_note.source_note_revision,
    current_note.provider, current_note.model
  );
  delete from public.ai_notes where id = current_note.id;
end;
$$;

revoke all on function public.discard_ai_note_versioned from public, anon;
grant execute on function public.discard_ai_note_versioned to authenticated;

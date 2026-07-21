begin;
create extension if not exists pgtap;
select plan(7);

select ok((select relrowsecurity from pg_class where oid = 'public.personal_notes'::regclass), 'personal_notes has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_notes'::regclass), 'ai_notes has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.review_states'::regclass), 'review_states has RLS enabled');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'personal_notes'), 1, 'personal notes have one owner policy');
select is((select count(*)::integer from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'upsert_ai_notes_batch' and grantee = 'authenticated'), 0, 'transactional AI batch is service-role only');
select ok(has_function_privilege('service_role', 'public.upsert_ai_note_versioned(uuid,uuid,integer,jsonb,integer,public.ai_provider,text)', 'EXECUTE'), 'service role can execute versioned AI upsert');
select like(pg_get_functiondef('public.upsert_ai_note_versioned(uuid,uuid,integer,jsonb,integer,public.ai_provider,text)'::regprocedure), '%auth.role()%service_role%', 'AI upsert authorizes the current JWT role');

select * from finish();
rollback;

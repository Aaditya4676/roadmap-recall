begin;
create extension if not exists pgtap;
select plan(19);

select ok((select relrowsecurity from pg_class where oid = 'public.personal_notes'::regclass), 'personal_notes has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.ai_notes'::regclass), 'ai_notes has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.review_states'::regclass), 'review_states has RLS enabled');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'personal_notes'), 1, 'personal notes have one owner policy');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'review_events' and cmd in ('UPDATE', 'DELETE')), 0, 'review history has no owner update or delete policy');
select is((select count(*)::integer from information_schema.routine_privileges where routine_schema = 'public' and routine_name = 'upsert_ai_notes_batch' and grantee = 'authenticated'), 0, 'transactional AI batch is service-role only');
select ok(has_function_privilege('service_role', 'public.upsert_ai_note_versioned(uuid,uuid,integer,jsonb,integer,public.ai_provider,text)', 'EXECUTE'), 'service role can execute versioned AI upsert');
select like(pg_get_functiondef('public.upsert_ai_note_versioned(uuid,uuid,integer,jsonb,integer,public.ai_provider,text)'::regprocedure), '%auth.role()%service_role%', 'AI upsert authorizes the current JWT role');
select has_column('public', 'personal_notes', 'recall_questions', 'personal notes store authored recall questions');
select ok(has_function_privilege('authenticated', 'public.activate_study_topic_v2(uuid,text,text,public.topic_kind,public.roadmap_part,date,timestamp with time zone,public.scheduler_kind,smallint,timestamp with time zone,date,jsonb,text,jsonb)', 'EXECUTE'), 'authenticated owner can create a topic with initial recall questions');
select ok(has_function_privilege('authenticated', 'public.record_topic_review_v2(uuid,integer,public.review_rating,timestamp with time zone,date,jsonb,text,boolean,jsonb)', 'EXECUTE'), 'authenticated owner can record structured recall');
select ok(not has_function_privilege('anon', 'public.record_topic_review_v2(uuid,integer,public.review_rating,timestamp with time zone,date,jsonb,text,boolean,jsonb)', 'EXECUTE'), 'anonymous clients cannot record structured recall');
select has_column('public', 'review_events', 'continuous_grade', 'review events preserve continuous AI evidence');
select ok(has_function_privilege('authenticated', 'public.record_topic_review_v4(uuid,integer,public.review_rating,timestamp with time zone,date,jsonb,text,boolean,jsonb,jsonb,double precision)', 'EXECUTE'), 'authenticated owner can atomically record continuous AI evidence');
select ok(not has_function_privilege('anon', 'public.apply_review_ai_judgment_v2(uuid,integer,public.review_rating,jsonb,double precision,jsonb)', 'EXECUTE'), 'anonymous clients cannot replay continuous AI judgments');
select ok(not has_function_privilege('anon', 'public.apply_existing_ai_continuous_grade(uuid,integer,jsonb,double precision,jsonb)', 'EXECUTE'), 'anonymous clients cannot upgrade legacy AI schedules');
select ok(not has_function_privilege('anon', 'public.record_topic_review_v4(uuid,integer,public.review_rating,timestamp with time zone,date,jsonb,text,boolean,jsonb,jsonb,double precision)', 'EXECUTE'), 'anonymous clients cannot record continuous AI evidence');
select ok(has_function_privilege('authenticated', 'public.apply_review_ai_judgment_v2(uuid,integer,public.review_rating,jsonb,double precision,jsonb)', 'EXECUTE'), 'authenticated owner can apply a continuous AI judgment');
select ok(has_function_privilege('authenticated', 'public.apply_existing_ai_continuous_grade(uuid,integer,jsonb,double precision,jsonb)', 'EXECUTE'), 'authenticated owner can upgrade a legacy AI schedule');

select * from finish();
rollback;

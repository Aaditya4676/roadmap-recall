-- Auth users may have been created before 0001 installed the profile trigger.
-- Keep this migration idempotent so it is also safe as a production repair.

create or replace function public.create_profile_for_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_profile on auth.users;

create trigger auth_user_profile
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

insert into public.profiles (id, email, display_name)
select
  users.id,
  coalesce(users.email, ''),
  coalesce(
    users.raw_user_meta_data ->> 'name',
    split_part(coalesce(users.email, ''), '@', 1)
  )
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null
on conflict (id) do nothing;

-- Bot untuk main solo.
-- Bot adalah akun tetap tanpa email/password (tidak bisa login), dipakai bergantian di
-- banyak room. Satu room maksimal 6 kursi, jadi cukup 5 akun bot.
alter table public.profiles add column is_bot boolean not null default false;
alter table public.room_members add column is_bot boolean not null default false;

insert into auth.users (id, instance_id, aud, role, raw_user_meta_data)
select
  ('00000000-0000-4000-8000-00000000b00' || n)::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  jsonb_build_object('display_name', 'Bot Wkwk ' || n)
from generate_series(1, 5) as n
on conflict (id) do nothing;

update public.profiles
set is_bot = true
where id in (select ('00000000-0000-4000-8000-00000000b00' || n)::uuid from generate_series(1, 5) as n);

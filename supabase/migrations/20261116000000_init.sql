-- Negeri Wkwk: skema awal
-- Prinsip:
--   1. Klien HANYA membaca. Semua penulisan lewat Edge Functions (service role).
--   2. State permainan publik disimpan utuh di game_states.state (jsonb) dengan versi
--      untuk optimistic locking.
--   3. Peran rahasia (Buzzer) & mimpi pribadi ada di tabel terpisah yang hanya bisa
--      dibaca pemiliknya.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profil pemain
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  emas_antum   integer not null default 0 check (emas_antum >= 0), -- mata uang premium
  created_at   timestamptz not null default now()
);

-- Buat profil otomatis saat user daftar
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(left(new.raw_user_meta_data ->> 'display_name', 24), ''),
      'Warga' || substr(replace(new.id::text, '-', ''), 1, 5)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Room
-- ---------------------------------------------------------------------------
create table public.rooms (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id     uuid not null references public.profiles (id) on delete cascade,
  mode        text not null default 'rakyat_bersatu'
              check (mode in ('rakyat_bersatu', 'juragan')),
  max_players smallint not null default 6 check (max_players between 2 and 6),
  status      text not null default 'lobby'
              check (status in ('lobby', 'playing', 'finished')),
  created_at  timestamptz not null default now()
);

create table public.room_members (
  room_id      uuid not null references public.rooms (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  seat         smallint not null check (seat between 0 and 5),
  display_name text not null,
  profession   text check (profession in
               ('buruh', 'pedagang', 'ojol', 'kreator', 'jurnalis', 'mahasiswa')),
  joined_at    timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

create index room_members_user_idx on public.room_members (user_id);

-- ---------------------------------------------------------------------------
-- State permainan (publik untuk anggota room)
-- ---------------------------------------------------------------------------
create table public.game_states (
  room_id    uuid primary key references public.rooms (id) on delete cascade,
  version    integer not null default 0,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Peran rahasia: hanya bisa dibaca pemiliknya
create table public.player_secrets (
  room_id uuid not null,
  user_id uuid not null,
  role    text not null default 'rakyat' check (role in ('rakyat', 'buzzer')),
  mimpi   text not null,
  primary key (room_id, user_id),
  foreign key (room_id, user_id)
    references public.room_members (room_id, user_id) on delete cascade
);

-- Log kejadian (dadu, sewa, kartu, kebijakan). visible_to diisi untuk kejadian
-- rahasia (mis. aksi Buzzer) supaya hanya orang itu yang bisa membacanya.
create table public.game_events (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references public.rooms (id) on delete cascade,
  version    integer not null,
  type       text not null,
  actor_id   uuid,
  visible_to uuid,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index game_events_room_idx on public.game_events (room_id, id);

-- ---------------------------------------------------------------------------
-- Helper RLS (security definer supaya tidak rekursif ke RLS room_members)
-- ---------------------------------------------------------------------------
create or replace function public.is_room_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.rooms          enable row level security;
alter table public.room_members   enable row level security;
alter table public.game_states    enable row level security;
alter table public.player_secrets enable row level security;
alter table public.game_events    enable row level security;

-- Klien hanya boleh SELECT; tulis lewat Edge Function (service role melewati RLS).
revoke all on public.profiles, public.rooms, public.room_members,
              public.game_states, public.player_secrets, public.game_events
  from anon, authenticated;

grant select on public.profiles, public.rooms, public.room_members,
               public.game_states, public.player_secrets, public.game_events
  to authenticated;

-- Pemain boleh ganti nama sendiri, tapi TIDAK boleh mengubah saldo Emas Antum.
grant update (display_name) on public.profiles to authenticated;

create policy "profil: baca sendiri"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profil: ubah nama sendiri"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "room: anggota bisa baca"
  on public.rooms for select to authenticated
  using (public.is_room_member(id));

create policy "anggota: sesama anggota bisa baca"
  on public.room_members for select to authenticated
  using (public.is_room_member(room_id));

create policy "state: anggota bisa baca"
  on public.game_states for select to authenticated
  using (public.is_room_member(room_id));

create policy "rahasia: hanya pemiliknya"
  on public.player_secrets for select to authenticated
  using (user_id = (select auth.uid()));

create policy "event: anggota bisa baca yang publik atau untuk dirinya"
  on public.game_events for select to authenticated
  using (
    public.is_room_member(room_id)
    and (visible_to is null or visible_to = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Realtime: klien berlangganan perubahan state, event, dan anggota room
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime
      add table public.game_states, public.game_events, public.room_members;
  end if;
end;
$$;

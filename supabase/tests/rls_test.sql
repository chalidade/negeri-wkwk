-- Uji RLS: jalankan setelah stub + migration.
\set ON_ERROR_STOP on

-- Tiga user: Andi & Budi satu room, Citra di luar room.
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"display_name":"Andi"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"display_name":"Budi"}'),
  ('00000000-0000-0000-0000-00000000000c', '{}');

insert into public.rooms (id, code, host_id)
values ('11111111-1111-1111-1111-111111111111', 'WKWK01',
        '00000000-0000-0000-0000-00000000000a');

insert into public.room_members (room_id, user_id, seat, display_name, profession) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 0, 'Andi', 'buruh'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', 1, 'Budi', 'ojol');

insert into public.game_states (room_id, state)
values ('11111111-1111-1111-1111-111111111111', '{"round":1}');

insert into public.player_secrets (room_id, user_id, role, mimpi) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'rakyat', 'beli_rumah'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b', 'buzzer', 'naik_haji');

insert into public.game_events (room_id, version, type, visible_to) values
  ('11111111-1111-1111-1111-111111111111', 1, 'dadu', null),
  ('11111111-1111-1111-1111-111111111111', 1, 'dana_operasional', '00000000-0000-0000-0000-00000000000b');

-- Profil otomatis dibuat oleh trigger
do $$ begin
  assert (select count(*) from public.profiles) = 3, 'trigger profil gagal';
  assert (select display_name from public.profiles
          where id = '00000000-0000-0000-0000-00000000000c') like 'Warga%', 'nama default salah';
end $$;

-- ===== Sebagai Andi (rakyat, anggota room) =====
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

do $$ begin
  assert (select count(*) from public.rooms) = 1, 'Andi harus lihat room';
  assert (select count(*) from public.room_members) = 2, 'Andi harus lihat 2 anggota';
  assert (select count(*) from public.game_states) = 1, 'Andi harus lihat state';
  assert (select count(*) from public.player_secrets) = 1, 'Andi hanya boleh lihat rahasia sendiri';
  assert (select role from public.player_secrets) = 'rakyat', 'rahasia Andi salah';
  assert (select count(*) from public.game_events) = 1, 'Andi tidak boleh lihat event rahasia Budi';
  assert (select count(*) from public.profiles) = 1, 'Andi hanya boleh lihat profil sendiri';
end $$;

-- Andi tidak boleh menulis state atau menambah Emas Antum
do $$ begin
  begin
    update public.game_states set version = 99;
    raise exception 'Andi bisa update game_states!';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set emas_antum = 999999;
    raise exception 'Andi bisa top up gratis!';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.game_events (room_id, version, type)
    values ('11111111-1111-1111-1111-111111111111', 2, 'curang');
    raise exception 'Andi bisa insert event!';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Tapi boleh ganti nama sendiri
update public.profiles set display_name = 'Andi Jaya';
do $$ begin
  assert (select display_name from public.profiles) = 'Andi Jaya', 'ganti nama gagal';
end $$;

-- ===== Sebagai Budi (buzzer) =====
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select role from public.player_secrets) = 'buzzer', 'Budi harus tahu dia buzzer';
  assert (select count(*) from public.game_events) = 2, 'Budi harus lihat event rahasianya';
end $$;

-- ===== Sebagai Citra (bukan anggota) =====
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  assert (select count(*) from public.rooms) = 0, 'Citra tidak boleh lihat room';
  assert (select count(*) from public.room_members) = 0, 'Citra tidak boleh lihat anggota';
  assert (select count(*) from public.game_states) = 0, 'Citra tidak boleh lihat state';
  assert (select count(*) from public.player_secrets) = 0, 'Citra tidak boleh lihat rahasia';
  assert (select count(*) from public.game_events) = 0, 'Citra tidak boleh lihat event';
end $$;

-- ===== Anon =====
reset role;
set role anon;
do $$ begin
  begin
    perform 1 from public.game_states;
    raise exception 'anon bisa baca game_states!';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
\echo 'SEMUA TES RLS LULUS'

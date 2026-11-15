-- ═══════════════════════════════════════════════════════════════════
-- SMART UBT — `users` КЕСТЕСІН ҚОРҒАУ, 1-ҚАДАМ (қолданбаны бұзбайды)
-- Supabase → SQL Editor ішінде бір рет іске қосыңыз.
-- ТАРТІП: алдымен migration-phase-b-admin.sql, содан кейін осы файл.
-- Бұл файл БАРЛЫҚ нәрсені жаппайды (толық жабу — 2-қадам, төменде).
-- Не істейді:
--   1) парольдерді хэштейді (бұрын ашық мәтінмен тұрды);
--   2) password бағанын анонимді оқудан жабады;
--   3) жазбаларды өшіруге тыйым салады;
--   4) legacy_login / legacy_change_password функцияларын хэшке бейімдейді.
-- ═══════════════════════════════════════════════════════════════════
begin;

create extension if not exists pgcrypto with schema extensions;

-- 1) Пароль триггері: ашық мәтін келсе — хэштейді; бос пароль ескісін өшірмейді.
create or replace function public.users_hash_password()
returns trigger
language plpgsql
security definer set search_path = public, extensions
as $fn$
begin
  if tg_op = 'UPDATE' and (new.password is null or new.password = '') then
    new.password := old.password;
  end if;
  if new.password is not null and new.password <> '' and new.password not like '$2_$%' then
    new.password := crypt(new.password, gen_salt('bf'));
  end if;
  return new;
end;
$fn$;

drop trigger if exists users_hash_password on public.users;
create trigger users_hash_password
  before insert or update of password on public.users
  for each row execute function public.users_hash_password();

-- Қазіргі ашық парольдерді бір рет хэштеу
update public.users
   set password = extensions.crypt(password, extensions.gen_salt('bf'))
 where password is not null and password <> '' and password not like '$2_$%';

-- 2) Кіру функциясы (құпия сөз клиентке қайтарылмайды)
drop function if exists public.legacy_login(text, text);
create function public.legacy_login(p_email text, p_password text)
returns setof jsonb
language sql
security definer set search_path = public, extensions
as $fn$
  select to_jsonb(u) - 'password'
    from public.users u
   where lower(u.email) = lower(p_email)
     and u.password is not null and u.password <> ''
     and u.password = crypt(p_password, u.password)
   limit 1;
$fn$;
grant execute on function public.legacy_login(text, text) to anon, authenticated;

-- 3) Пароль ауыстыру: ескі пароль серверде тексеріледі
create or replace function public.legacy_change_password(p_email text, p_old text, p_new text)
returns boolean
language plpgsql
security definer set search_path = public, extensions
as $fn$
begin
  if p_new is null or length(p_new) < 6 then
    return false;
  end if;
  update public.users
     set password = p_new            -- триггер хэштейді
   where lower(email) = lower(p_email)
     and password is not null and password <> ''
     and password = crypt(p_old, password);
  return found;
end;
$fn$;
grant execute on function public.legacy_change_password(text, text, text) to anon, authenticated;

-- 4) Кестеге қолжетімділік: password бағанын оқуға болмайды, өшіруге болмайды.
--    Қолданба дәл осы бағандарды ғана сұрайды (SAFE_USER_COLS).
alter table public.users enable row level security;

revoke all on public.users from anon, authenticated;
grant select (id, email, name, phone, grade, role, plan, subjects, xp, streak, avatar,
              unlock_code, status, progress, achievements, study_plan, created_at, auth_id)
  on public.users to anon, authenticated;
grant insert, update on public.users to anon, authenticated;

drop policy if exists users_select_all on public.users;
drop policy if exists users_insert_all on public.users;
drop policy if exists users_update_all on public.users;
-- ЕСКЕРТУ: бұл ережелер әзірге бәріне рұқсат береді (қазіргі қолданба сол арқылы жұмыс істейді).
-- 2-қадамда (қолданба Supabase Auth-қа көшкенде) осы ережелер қатаңдатылады.
create policy users_select_all on public.users for select to anon, authenticated using (true);
create policy users_insert_all on public.users for insert to anon, authenticated with check (true);
create policy users_update_all on public.users for update to anon, authenticated using (true) with check (true);
-- delete үшін ереже жоқ → өшіруге тыйым салынған.

commit;

-- ═══ ТЕКСЕРУ (SQL Editor-де бөлек іске қосыңыз) ═══
-- set role anon;
-- select password from public.users limit 1;     -- КҮТІЛЕТІН НӘТИЖЕ: permission denied
-- select email, role from public.users limit 1;  -- жұмыс істеуі керек
-- reset role;
-- select email, left(password, 4) as hash_start from public.users limit 3;   -- $2a$ / $2b$ болуы керек

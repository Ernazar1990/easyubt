-- ═══════════════════════════════════════════════════════════════════
-- SMART UBT — ВИДЕО СІЛТЕМЕЛЕРІ ЖӘНЕ «ТЕГІН САБАҚ» БЕЛГІСІ (серверде)
-- Тәртіп: 00-setup → phase-b-admin → phase-b-hardening → ОСЫ ФАЙЛ.
-- Видео сілтемелерін барлық оқушы көреді (оқу — ашық), жазуды тек админ
-- (парольмен расталған функция арқылы) жасай алады.
-- ═══════════════════════════════════════════════════════════════════
begin;

create table if not exists public.lesson_media (
  lesson_id  text primary key,
  video_url  text not null default '',
  is_free    boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.lesson_media enable row level security;
revoke all on public.lesson_media from anon, authenticated;
grant select on public.lesson_media to anon, authenticated;
drop policy if exists lesson_media_read on public.lesson_media;
create policy lesson_media_read on public.lesson_media for select to anon, authenticated using (true);
-- insert/update/delete үшін ереже жоқ → тікелей жазуға тыйым (тек төмендегі функция арқылы)

create or replace function public.admin_set_lesson_media(
  p_email text, p_password text, p_lesson_id text, p_video_url text, p_is_free boolean
) returns boolean
language plpgsql
security definer set search_path = public, extensions
as $fn$
declare ok boolean;
begin
  select true into ok
    from public.users u
   where lower(u.email) = lower(p_email)
     and u.role in ('admin', 'superadmin', 'curator')
     and u.password is not null and u.password <> ''
     and u.password = crypt(p_password, u.password);
  if ok is not true then return false; end if;
  if p_lesson_id !~ '^chem_c[0-9]+(_[0-9]+)?_(t[0-9]+|intro|summary|answers|review)$' then return false; end if;
  if coalesce(p_video_url, '') <> '' and p_video_url !~* '^https://' then return false; end if;
  insert into public.lesson_media (lesson_id, video_url, is_free, updated_at)
  values (p_lesson_id, coalesce(p_video_url, ''), coalesce(p_is_free, false), now())
  on conflict (lesson_id) do update
    set video_url = excluded.video_url, is_free = excluded.is_free, updated_at = now();
  return true;
end;
$fn$;
grant execute on function public.admin_set_lesson_media(text, text, text, text, boolean) to anon, authenticated;

commit;

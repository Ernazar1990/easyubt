-- ═══════════════════════════════════════════════════════════════════════
-- SMART UBT — САБАҚ МАЗМҰНЫ (бекіту, үй жұмысы, жазба, қате талдауы) ЖӘНЕ ПРОГРЕС (v45)
-- Тәртіп: ... → phase-d-server → ОСЫ ФАЙЛ.
--  • Админ қосқан бекіту/үй жұмысы сұрақтары, жазба тапсырмалары, қате талдауы
--    бейнелері мен PDF-тер серверде сақталып, барлық оқушыға көрінеді.
--  • Оқушының прогресі (видео қаралуы, бекіту, конспект, үй жұмысы) серверде
--    сақталады: құрылғы ауыстырса да жоғалмайды, админ көре алады.
-- ═══════════════════════════════════════════════════════════════════════
begin;

create table if not exists public.app_content (
  key        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.lesson_progress (
  user_id    bigint not null references public.users(id) on delete cascade,
  lesson_id  text   not null,
  data       jsonb  not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists lesson_progress_updated_idx on public.lesson_progress (updated_at desc);
alter table public.app_content     enable row level security;
alter table public.lesson_progress enable row level security;
revoke all on public.app_content, public.lesson_progress from anon, authenticated;

-- Мазмұнды оқу: кез келген кірген оқушы
create or replace function public.app_get_content(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_uid bigint := public.app_uid(p_token); v_data jsonb;
begin
  if v_uid is null then return jsonb_build_object('error', 'session'); end if;
  select data into v_data from public.app_content where key = 'main';
  return coalesce(v_data, '{}'::jsonb);
end;
$fn$;

-- Мазмұнды жариялау: тек админ
create or replace function public.app_admin_set_content(p_token text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_uid bigint := public.app_uid(p_token);
begin
  if v_uid is null or not public.app_is_admin(v_uid) then return jsonb_build_object('error', 'denied'); end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then return jsonb_build_object('error', 'data'); end if;
  if octet_length(p_data::text) > 8000000 then return jsonb_build_object('error', 'size'); end if;
  insert into public.app_content (key, data, updated_at) values ('main', p_data, now())
  on conflict (key) do update set data = excluded.data, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$fn$;

-- Прогресті сақтау (бір сабақ)
create or replace function public.app_save_progress(p_token text, p_lesson_id text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_uid bigint := public.app_uid(p_token);
begin
  if v_uid is null then return jsonb_build_object('error', 'session'); end if;
  if p_lesson_id !~ '^chem_c[0-9]+(_[0-9]+)?_(t[0-9]+|intro|summary|answers|review)$' then return jsonb_build_object('error', 'lesson'); end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 120000 then return jsonb_build_object('error', 'data'); end if;
  insert into public.lesson_progress (user_id, lesson_id, data, updated_at) values (v_uid, p_lesson_id, p_data, now())
  on conflict (user_id, lesson_id) do update set data = excluded.data, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$fn$;

-- Өз прогресін алу (басқа құрылғыда кіргенде)
create or replace function public.app_get_progress(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_uid bigint := public.app_uid(p_token);
begin
  if v_uid is null then return jsonb_build_object('error', 'session'); end if;
  return jsonb_build_object('progress',
    coalesce((select jsonb_object_agg(lesson_id, data) from public.lesson_progress where user_id = v_uid), '{}'::jsonb));
end;
$fn$;

-- Админге: барлық оқушының прогресі (мониторинг)
create or replace function public.app_admin_progress(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_uid bigint := public.app_uid(p_token);
begin
  if v_uid is null or not exists (select 1 from public.staff where user_id = v_uid) then
    return jsonb_build_object('error', 'denied');
  end if;
  return jsonb_build_object('rows', coalesce((
    select jsonb_agg(jsonb_build_object('email', u.email, 'name', u.name, 'lesson_id', p.lesson_id, 'data', p.data, 'at', p.updated_at))
      from public.lesson_progress p join public.users u on u.id = p.user_id
  ), '[]'::jsonb));
end;
$fn$;

grant execute on function
  public.app_get_content(text), public.app_admin_set_content(text, jsonb), public.app_save_progress(text, text, jsonb),
  public.app_get_progress(text), public.app_admin_progress(text)
  to anon, authenticated;

commit;

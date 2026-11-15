-- ═══════════════════════════════════════════════════════════════════════
-- SMART UBT — СЕРВЕРЛІК ТЕСТ, ТЕОРИЯ, КІРУ ЖӘНЕ ТАРИФ (v44)
-- Тәртіп: 00-setup → phase-b-admin → phase-b-hardening → phase-c-media → ОСЫ ФАЙЛ.
-- Бұл файл:
--   • кіру/тіркелу/сессия (парольдер хэште, 10 минутта 10 қате әрекеттен кейін құлыптау);
--   • тарифті (entitlements) және админ құқығын (staff) клиент өзгерте алмайтын кестелерге шығарады;
--   • теория мен тест жауаптарын серверде сақтайды, тек құқығы барларға береді;
--   • тест баллын серверде ресми кесте бойынша есептейді.
-- Бастапқы мазмұнды жүктеу: tools/upload_content.py (ORNATU.md, 3-қадам).
-- ═══════════════════════════════════════════════════════════════════════
begin;

create extension if not exists pgcrypto with schema extensions;

-- ── 1. Кестелер ────────────────────────────────────────────────────────
create table if not exists public.staff (
  user_id bigint primary key references public.users(id) on delete cascade,
  role    text not null check (role in ('admin','superadmin','curator'))
);
create table if not exists public.entitlements (
  user_id    bigint primary key references public.users(id) on delete cascade,
  plan       text not null default 'free',
  granted_at timestamptz not null default now()
);
create table if not exists public.activation_codes (
  code       text primary key,
  user_id    bigint not null references public.users(id) on delete cascade,
  plan       text not null default 'premium',
  created_at timestamptz not null default now(),
  used_at    timestamptz
);
create table if not exists public.app_sessions (
  token      text primary key default encode(extensions.gen_random_bytes(24), 'hex'),
  user_id    bigint not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 days')
);
create table if not exists public.app_login_attempts (
  email text not null,
  at    timestamptz not null default now()
);
create index if not exists app_login_attempts_idx on public.app_login_attempts (email, at);
create table if not exists public.test_bank (
  test_id     text primary key,
  chapter     int  not null,
  title       text not null default '',
  minutes     int  not null default 60,
  public_json jsonb not null,
  key_json    jsonb not null,
  updated_at  timestamptz not null default now()
);
create table if not exists public.theory_bank (
  lesson_id  text primary key,
  html       text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.test_attempts (
  id          bigint generated always as identity primary key,
  user_id     bigint not null references public.users(id) on delete cascade,
  test_id     text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  answers     jsonb,
  points      int,
  max_points  int
);

-- Бұл кестелерге клиент тікелей қол жеткізбейді (ереже жоқ) — тек төмендегі функциялар арқылы
alter table public.staff            enable row level security;
alter table public.entitlements     enable row level security;
alter table public.activation_codes enable row level security;
alter table public.app_sessions     enable row level security;
alter table public.app_login_attempts enable row level security;
alter table public.test_bank        enable row level security;
alter table public.theory_bank      enable row level security;
alter table public.test_attempts    enable row level security;
revoke all on public.staff, public.entitlements, public.activation_codes, public.app_sessions,
              public.app_login_attempts, public.test_bank, public.theory_bank, public.test_attempts
  from anon, authenticated;

-- Әкімшілер (SQL арқылы ғана өзгереді). Қосымша админ керек болса, осы жерге email қосыңыз.
insert into public.staff (user_id, role)
select id, case when lower(email) = 'ernazarnurtay@gmail.com' then 'superadmin' else 'admin' end
  from public.users
 where lower(email) in ('nur.abuuadi@gmail.com', 'ernazarnurtay@gmail.com')
on conflict (user_id) do update set role = excluded.role;

-- Тегін сабақтар (админ панелінен өзгертіледі)
insert into public.lesson_media (lesson_id, video_url, is_free)
values ('chem_c1_intro', '', true), ('chem_c1_t1', '', true)
on conflict (lesson_id) do nothing;

-- ── 2. Көмекші функциялар ──────────────────────────────────────────────
create or replace function public.app_uid(p_token text)
returns bigint language sql stable security definer set search_path = public as $fn$
  select user_id from public.app_sessions where token = p_token and expires_at > now() limit 1;
$fn$;

create or replace function public.app_is_admin(p_uid bigint)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.staff where user_id = p_uid and role in ('admin', 'superadmin'));
$fn$;

create or replace function public.app_user_json(p_uid bigint)
returns jsonb language sql stable security definer set search_path = public as $fn$
  select (to_jsonb(u) - 'password' - 'unlock_code')
         || jsonb_build_object('role', coalesce(s.role, 'student'), 'plan', coalesce(e.plan, 'free'))
    from public.users u
    left join public.staff s on s.user_id = u.id
    left join public.entitlements e on e.user_id = u.id
   where u.id = p_uid;
$fn$;

create or replace function public.app_has_access(p_uid bigint, p_lesson_id text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.staff where user_id = p_uid)
      or exists (select 1 from public.entitlements where user_id = p_uid and plan in ('premium', 'basic', 'package'))
      or exists (select 1 from public.lesson_media where lesson_id = p_lesson_id and is_free);
$fn$;

-- Көп жауапты және сәйкестендіру тапсырмаларының ресми бағалау кестесі (ҰБТ Ережелері, 18-тармақ)
create or replace function public.multi_score(c int, s int, w int)
returns int language sql immutable as $fn$
  select case
    when w >= 2 or c <= 0 then 0
    when c = 1 then case when s = 1 and w = 0 then 2 when s = 1 and w = 1 then 1 else 0 end
    when c = 2 then case when s = 2 and w = 0 then 2 when s >= 1 then 1 else 0 end
    when c = 3 then case when s = 3 and w = 0 then 2 when s >= 2 then 1 else 0 end
    else case when s = c and w = 0 then 2 when s >= c - 1 and s >= 2 then 1 else 0 end
  end;
$fn$;

-- ── 3. Тіркелу, кіру, сессия ───────────────────────────────────────────
create or replace function public.app_register(p_email text, p_password text, p_name text, p_phone text, p_grade text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id    bigint;
  v_tok   text;
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' then
    return jsonb_build_object('error', 'email');
  end if;
  if p_password is null or length(p_password) < 6 then
    return jsonb_build_object('error', 'password');
  end if;
  if exists (select 1 from public.users where lower(email) = v_email) then
    return jsonb_build_object('error', 'exists');
  end if;
  insert into public.users (email, password, name, phone, grade, role, plan, subjects, status)
  values (v_email, p_password, coalesce(nullif(trim(p_name), ''), 'Оқушы'), coalesce(trim(p_phone), ''),
          coalesce(nullif(trim(p_grade), ''), '11'), 'student', 'free', '["chemistry"]'::jsonb, 'active')
  returning id into v_id;
  insert into public.entitlements (user_id, plan) values (v_id, 'free');
  insert into public.app_sessions (user_id) values (v_id) returning token into v_tok;
  return jsonb_build_object('token', v_tok, 'user', public.app_user_json(v_id));
end;
$fn$;

create or replace function public.app_login(p_email text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $fn$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_id    bigint;
  v_hash  text;
  v_fails int;
  v_tok   text;
begin
  select count(*) into v_fails from public.app_login_attempts
   where email = v_email and at > now() - interval '10 minutes';
  if v_fails >= 10 then
    return jsonb_build_object('error', 'locked');
  end if;
  select id, password into v_id, v_hash from public.users where lower(email) = v_email limit 1;
  if v_id is null or v_hash is null or v_hash = '' or v_hash <> crypt(coalesce(p_password, ''), v_hash) then
    insert into public.app_login_attempts (email) values (v_email);
    return jsonb_build_object('error', 'invalid');
  end if;
  delete from public.app_login_attempts where email = v_email;
  insert into public.app_sessions (user_id) values (v_id) returning token into v_tok;
  return jsonb_build_object('token', v_tok, 'user', public.app_user_json(v_id));
end;
$fn$;

create or replace function public.app_me(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_uid bigint := public.app_uid(p_token);
begin
  if v_uid is null then return jsonb_build_object('error', 'session'); end if;
  return jsonb_build_object('user', public.app_user_json(v_uid));
end;
$fn$;

create or replace function public.app_logout(p_token text)
returns boolean language plpgsql security definer set search_path = public as $fn$
begin
  delete from public.app_sessions where token = p_token;
  return true;
end;
$fn$;

-- ── 4. Активация коды және тариф ───────────────────────────────────────
create or replace function public.app_redeem_code(p_token text, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_uid  bigint := public.app_uid(p_token);
  v_code text := upper(trim(coalesce(p_code, '')));
  v_plan text;
begin
  if v_uid is null then return jsonb_build_object('error', 'session'); end if;
  update public.activation_codes
     set used_at = now()
   where code = v_code and user_id = v_uid and used_at is null
  returning plan into v_plan;
  if v_plan is null then return jsonb_build_object('error', 'code'); end if;
  insert into public.entitlements (user_id, plan) values (v_uid, v_plan)
  on conflict (user_id) do update set plan = excluded.plan, granted_at = now();
  return jsonb_build_object('ok', true, 'user', public.app_user_json(v_uid));
end;
$fn$;

create or replace function public.app_admin_issue_code(p_token text, p_email text, p_plan text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_uid  bigint := public.app_uid(p_token);
  v_tid  bigint;
  v_code text;
  v_name text;
  v_phone text;
begin
  if v_uid is null or not public.app_is_admin(v_uid) then return jsonb_build_object('error', 'denied'); end if;
  select id, name, phone into v_tid, v_name, v_phone from public.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_tid is null then return jsonb_build_object('error', 'user'); end if;
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text || v_tid::text), 1, 6));
  insert into public.activation_codes (code, user_id, plan)
  values (v_code, v_tid, case when p_plan in ('premium', 'basic', 'package') then p_plan else 'premium' end);
  return jsonb_build_object('code', v_code, 'name', v_name, 'phone', coalesce(v_phone, ''));
end;
$fn$;

create or replace function public.app_admin_set_plan(p_token text, p_email text, p_plan text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_uid bigint := public.app_uid(p_token);
  v_tid bigint;
begin
  if v_uid is null or not public.app_is_admin(v_uid) then return jsonb_build_object('error', 'denied'); end if;
  select id into v_tid from public.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_tid is null then return jsonb_build_object('error', 'user'); end if;
  insert into public.entitlements (user_id, plan) values (v_tid, case when p_plan in ('free', 'premium', 'basic', 'package') then p_plan else 'free' end)
  on conflict (user_id) do update set plan = excluded.plan, granted_at = now();
  return jsonb_build_object('ok', true);
end;
$fn$;

create or replace function public.app_admin_list_users(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare v_uid bigint := public.app_uid(p_token);
begin
  if v_uid is null or not exists (select 1 from public.staff where user_id = v_uid) then
    return jsonb_build_object('error', 'denied');
  end if;
  return jsonb_build_object('users', coalesce((select jsonb_agg(public.app_user_json(id) order by id) from public.users), '[]'::jsonb));
end;
$fn$;

-- ── 5. Теория мен тест беру ────────────────────────────────────────────
create or replace function public.app_get_theory(p_token text, p_lesson_id text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_uid  bigint := public.app_uid(p_token);
  v_html text;
begin
  if v_uid is null then return jsonb_build_object('error', 'session'); end if;
  if not public.app_has_access(v_uid, p_lesson_id) then return jsonb_build_object('error', 'access'); end if;
  select html into v_html from public.theory_bank where lesson_id = p_lesson_id;
  if v_html is null then return jsonb_build_object('error', 'missing'); end if;
  return jsonb_build_object('html', v_html);
end;
$fn$;

create or replace function public.app_get_test(p_token text, p_test_id text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_uid bigint := public.app_uid(p_token);
  v_t   public.test_bank%rowtype;
  v_aid bigint;
begin
  if v_uid is null then return jsonb_build_object('error', 'session'); end if;
  if not public.app_has_access(v_uid, p_test_id) then return jsonb_build_object('error', 'access'); end if;
  select * into v_t from public.test_bank where test_id = p_test_id;
  if not found then return jsonb_build_object('error', 'missing'); end if;
  insert into public.test_attempts (user_id, test_id) values (v_uid, p_test_id) returning id into v_aid;
  return jsonb_build_object('attempt_id', v_aid, 'minutes', v_t.minutes, 'title', v_t.title, 'questions', v_t.public_json);
end;
$fn$;

-- Баллды серверде есептеу: бір жауап/мәнмәтін — 1 балл; көп жауап/сәйкестендіру — multi_score кестесі
create or replace function public.app_submit_test(p_token text, p_attempt_id bigint, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_uid    bigint := public.app_uid(p_token);
  v_att    public.test_attempts%rowtype;
  v_key    jsonb;
  v_n      int;
  v_i      int;
  v_j      int;
  k        jsonb;
  v_kind   text;
  v_ans    jsonb;
  v_pts    int;
  v_w      int;
  v_c      int;
  v_s      int;
  v_wr     int;
  v_cor    jsonb;
  v_given  jsonb;
  v_x      jsonb;
  v_val    jsonb;
  v_total  int := 0;
  v_max    int := 0;
  v_det    jsonb := '[]'::jsonb;
begin
  if v_uid is null then return jsonb_build_object('error', 'session'); end if;
  select * into v_att from public.test_attempts where id = p_attempt_id and user_id = v_uid;
  if not found then return jsonb_build_object('error', 'attempt'); end if;
  if v_att.finished_at is not null then return jsonb_build_object('error', 'done'); end if;
  select key_json into v_key from public.test_bank where test_id = v_att.test_id;
  if v_key is null then return jsonb_build_object('error', 'missing'); end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then p_answers := '[]'::jsonb; end if;
  v_n := jsonb_array_length(v_key);
  for v_i in 0 .. v_n - 1 loop
    k      := v_key -> v_i;
    v_kind := k ->> 'kind';
    v_ans  := coalesce(p_answers -> v_i, 'null'::jsonb);
    v_pts  := 0;
    if v_kind in ('single', 'context') then
      v_w := 1;
      if jsonb_typeof(v_ans) = 'number' and (v_ans #>> '{}')::int = (k ->> 'ans')::int then v_pts := 1; end if;
      v_cor := k -> 'ans';
    elsif v_kind = 'multi' then
      v_w := 2;
      v_cor := k -> 'ans_all';
      v_c := jsonb_array_length(v_cor);
      v_s := 0; v_wr := 0;
      if jsonb_typeof(v_ans) = 'array' then
        for v_x in select distinct value from jsonb_array_elements(v_ans) loop
          if v_cor @> jsonb_build_array(v_x) then v_s := v_s + 1; else v_wr := v_wr + 1; end if;
        end loop;
      end if;
      v_pts := public.multi_score(v_c, v_s, v_wr);
    else  -- match
      v_w := 2;
      v_cor := k -> 'ans';
      v_c := jsonb_array_length(v_cor);
      v_s := 0; v_wr := 0;
      if jsonb_typeof(v_ans) = 'object' then
        for v_j in 0 .. v_c - 1 loop
          v_val := v_ans -> (v_j::text);
          if v_val is not null and jsonb_typeof(v_val) = 'number' then
            if v_val = (v_cor -> v_j) then v_s := v_s + 1; else v_wr := v_wr + 1; end if;
          end if;
        end loop;
      end if;
      v_pts := public.multi_score(v_c, v_s, v_wr);
    end if;
    v_total := v_total + v_pts;
    v_max   := v_max + v_w;
    v_det := v_det || jsonb_build_array(jsonb_build_object('kind', v_kind, 'pts', v_pts, 'w', v_w, 'correct', v_cor, 'exp', k -> 'exp'));
  end loop;
  update public.test_attempts
     set finished_at = now(), answers = p_answers, points = v_total, max_points = v_max
   where id = p_attempt_id;
  return jsonb_build_object('points', v_total, 'max', v_max, 'details', v_det);
end;
$fn$;

-- ── 6. Видео админ функциясы: енді құқық staff кестесінен тексеріледі ──
create or replace function public.admin_set_lesson_media(
  p_email text, p_password text, p_lesson_id text, p_video_url text, p_is_free boolean
) returns boolean language plpgsql security definer set search_path = public, extensions as $fn$
declare ok boolean;
begin
  select true into ok
    from public.users u join public.staff s on s.user_id = u.id
   where lower(u.email) = lower(p_email)
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

-- ── 7. Рұқсаттар ───────────────────────────────────────────────────────
grant execute on function
  public.app_register(text, text, text, text, text), public.app_login(text, text), public.app_me(text),
  public.app_logout(text), public.app_redeem_code(text, text), public.app_admin_issue_code(text, text, text),
  public.app_admin_set_plan(text, text, text), public.app_admin_list_users(text),
  public.app_get_theory(text, text), public.app_get_test(text, text), public.app_submit_test(text, bigint, jsonb),
  public.admin_set_lesson_media(text, text, text, text, boolean)
  to anon, authenticated;
-- Ішкі көмекші функцияларды клиент шақырмайды
revoke execute on function public.app_uid(text), public.app_is_admin(bigint), public.app_user_json(bigint),
  public.app_has_access(bigint, text), public.multi_score(int, int, int) from anon, authenticated, public;

-- ── 8. Өздігінен тексеру: бағалау кестесі дұрыс болмаса, файл тоқтайды ──
do $test$
begin
  assert public.multi_score(1, 1, 0) = 2, 'c=1 s=1 w=0';
  assert public.multi_score(1, 1, 1) = 1, 'c=1 s=1 w=1';
  assert public.multi_score(2, 1, 1) = 1, 'c=2 s=1 w=1 (A,C дұрыс; A,D таңдалды)';
  assert public.multi_score(2, 2, 1) = 1, 'c=2 s=2 w=1';
  assert public.multi_score(2, 2, 0) = 2, 'c=2 s=2 w=0';
  assert public.multi_score(3, 3, 1) = 1, 'c=3 s=3 w=1';
  assert public.multi_score(3, 1, 0) = 0, 'c=3 s=1 w=0';
  assert public.multi_score(3, 2, 2) = 0, 'w>=2';
end
$test$;

commit;

-- ═══ 2-ҚАДАМ: ҚОЛДАНБА v44-ке көшкен соң (тіркелу, кіру, тест — бәрі серверде) ═══
-- Мына жолдарды БӨЛЕК іске қосыңыз. Олар `users` кестесіне тікелей кіруді толық жабады
-- (телефон мен email-ді оқуға, тарифті өзгертуге болмайды).
-- begin;
--   revoke all on public.users from anon, authenticated;
-- commit;
-- Тексеру:  set role anon; select * from public.users limit 1;  -- permission denied болуы керек;  reset role;

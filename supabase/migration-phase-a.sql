-- ═══════════════════════════════════════════════════════════
-- SMART UBT — SUPABASE AUTH MIGRATION, PHASE A
-- Project: xdogbiyqcrrjlddmgiti
-- Бұл скрипт ЕСКІ `users` кестеңізге ТИМЕЙДІ, JSX-ті бұзбайды.
-- Тек жаңа инфрақұрылымды дайындайды (қатар жұмыс істейді).
-- ═══════════════════════════════════════════════════════════

-- 1) profiles: Supabase Auth-тың auth.users кестесіне 1-1 байланысқан,
--    құпиясөзсіз, тек публикалық профиль өрістері.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text default '',
  phone text default '',
  grade text default '11',
  role text not null default 'student' check (role in ('student','curator','admin','superadmin')),
  plan text not null default 'free' check (plan in ('free','premium')),
  subjects jsonb default '[]'::jsonb,
  xp integer default 0,
  streak integer default 0,
  avatar text default '🧑‍🎓',
  unlock_code text,
  status text default 'active',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Әркім тек ӨЗ профилін оқи/жаза алады.
create policy "select_own_profile" on public.profiles
  for select using (auth.uid() = id);

create policy "update_own_profile" on public.profiles
  for update using (auth.uid() = id);

-- Жаңа auth.users жазылғанда автоматты profiles жолы жасалады.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name',''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) role/rank сияқты «құпия» өрістерге қол жеткізу тек admin/superadmin-ге
--    керек болады (мысалы, барлық студенттердің тізімін көру).
--    Бұған security-definer функция арқылы, RLS-ті бұзбай қол жеткіземіз:
create or replace function public.get_all_profiles_for_admin()
returns setof public.profiles
language plpgsql
security definer set search_path = public
as $$
begin
  if (select role from public.profiles where id = auth.uid()) in ('admin','superadmin') then
    return query select * from public.profiles;
  else
    raise exception 'access denied';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════
-- ЕСКЕ САЛУ: ескі `users` кестесінің RLS-і әлі бос (public read/write).
-- Оны Phase B-де, JSX жаңа auth-қа толық көшкенде ғана жабамыз —
-- әйтпесе қазіргі production логин дереу бұзылады.
-- ═══════════════════════════════════════════════════════════

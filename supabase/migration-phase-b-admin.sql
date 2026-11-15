-- ═══════════════════════════════════════════════════════════
-- SMART UBT — ӘКІМШІ (ADMIN) + ПАРОЛЬ АУЫСТЫРУ
-- Supabase → SQL Editor ішінде бір рет іске қосыңыз.
-- Ескерту: `users` кестесінде `password` бағаны бар деп есептеледі
-- (сіздің legacy_login функциясы да сол бағанды пайдаланады).
-- ═══════════════════════════════════════════════════════════

-- 1) Әкімші және супер-әкімші аккаунттары. Егер бар болса, тек рөлі мен
--    тарифі түзетіледі, паролі ТИМЕЙДІ. Жоқ болса, уақытша пароль қойылады —
--    кіргеннен кейін бірден ауыстырыңыз (Баптаулар → Құпия сөзді өзгерту).
--    Кіру тек осы кестедегі жазба арқылы тексеріледі, сондықтан екеуі де осында болуы КЕРЕК.
insert into public.users (email, password, name, role, plan, status)
values
  ('nur.abuuadi@gmail.com',   'ОСЫНДА_УАҚЫТША_ПАРОЛЬ_ЖАЗЫҢЫЗ', 'Нұртай', 'admin',      'premium', 'active'),
  ('ernazarnurtay@gmail.com', 'ОСЫНДА_УАҚЫТША_ПАРОЛЬ_ЖАЗЫҢЫЗ', 'Ернazар', 'superadmin', 'premium', 'active')
on conflict (email) do update
  set role = excluded.role, plan = 'premium';

-- Тексеру: екі жол шығуы керек
select email, role, plan, (password is not null and password <> '') as has_password
from public.users
where email in ('nur.abuuadi@gmail.com','ernazarnurtay@gmail.com');

-- 2) Парольді өзгерту: ескі пароль серверде тексеріледі.
create or replace function public.legacy_change_password(
  p_email text, p_old text, p_new text
) returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if p_new is null or length(p_new) < 6 then
    return false;
  end if;
  update public.users
     set password = p_new
   where email = p_email and password = p_old;
  return found;
end;
$$;

grant execute on function public.legacy_change_password(text, text, text) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════
-- 3) КІРУ ПАРОЛІН ҚОЛМЕН ҚОЮ (кіре алмай қалсаңыз).
--    Кіргеннен кейін Баптаулар → Құпия сөзді өзгерту арқылы ауыстырыңыз.
-- ═══════════════════════════════════════════════════════════
-- update public.users set password = 'Start-2026-Chem'
--  where email in ('nur.abuuadi@gmail.com','ernazarnurtay@gmail.com');

-- ═══════════════════════════════════════════════════════════
-- 4) ТЕК кіру бетінде «legacy_login функциясы табылмады» деген қате шықса:
--    функцияны қайта жасайды. Құпия сөз клиентке қайтарылмайды.
-- ═══════════════════════════════════════════════════════════
-- drop function if exists public.legacy_login(text, text);
-- create function public.legacy_login(p_email text, p_password text)
-- returns setof jsonb
-- language sql
-- security definer set search_path = public
-- as $$
--   select to_jsonb(u) - 'password'
--   from public.users u
--   where u.email = p_email and u.password = p_password
--   limit 1;
-- $$;
-- grant execute on function public.legacy_login(text, text) to anon, authenticated;

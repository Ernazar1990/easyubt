# Smart UBT v44 — орнату нұсқаулығы

v44-те тіркелу, кіру, теория, тест және баллды есептеу **серверде** жүреді. Тест жауаптары мен ақылы теория браузер кодында жоқ.
Алдымен Supabase-ті дайындаңыз, содан кейін Vercel-ге жариялаңыз (қарама-қарсы тәртіппен қолданба істемейді).

## 1. Supabase — SQL Editor (осы ретпен, әрқайсысы бөлек)
1. `supabase/00-setup-new-project.sql`
2. `supabase/migration-phase-b-admin.sql` — екі админге уақытша пароль жазыңыз (`Nurtay1990@` орнына)
3. `supabase/migration-phase-b-hardening.sql`
4. `supabase/migration-phase-c-media.sql`
5. `supabase/migration-phase-d-server.sql` — соңында өздігінен тексеру бар; қате болса, мәтінін көшіріп жіберіңіз
Authentication бөлімі енді қажет емес (тіркелу Supabase Auth-сыз жүреді).

## 2. Мазмұнды серверге жүктеу (өз компьютеріңізде, бір рет)
Керек: Python 3. Supabase → Project Settings → API Keys → **service_role** кілті (ҚҰПИЯ: оны кодқа, GitHub-қа, Vercel-ге салмаңыз).
```
export SUPABASE_URL=https://ЖОБА.supabase.co
export SUPABASE_SERVICE_KEY=<service_role кілті>
python3 tools/upload_content.py --dry-run     # тексеру
python3 tools/upload_content.py               # жүктеу: 35 тест, 304 сабақ теориясы
```
(Windows PowerShell: `$env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_KEY="..."`)

## 3. Vercel
Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon, `eyJ...`). Redeploy.
GitHub-қа жүктегенде Git командаларын/GitHub Desktop-ты қолданыңыз; репозиторий **Private**. `server_data/` қалтасы .gitignore-да — оны репозиторийге салмаңыз.

## 4. Тексеру
1. Сайтта тегін тіркеліңіз → тегін §1 ашылады, §2 құлыпталған.
2. Админмен кіріңіз → «Активация» → оқушының email-імен код жасаңыз → оқушы кодты енгізеді → Премиум.
3. Қорытынды тест → 40 сұрақ, нәтиже серверде есептеледі.
4. Бәрі дұрыс болса, `users` кестесін толық жабыңыз: `migration-phase-d-server.sql` соңындағы «2-ҚАДАМ» блогын бөлек іске қосыңыз.

## 5. Күнделікті жұмыс
- Видео: Админ → «Видео сілтемелері» (сілтемені қойып, админ парольмен сақтау).
- Оқушыға тариф: Админ → «Активация».
- Word файлдары өзгерсе: `python3 tools/build_content.py <docx қалтасы> <md қалтасы>` және `python3 tools/build_tests.py <md қалтасы>`, содан кейін 2-қадамды қайталаңыз.

## 6. Белгілі шектеулер
- Прогресс, XP мен нәтижелер әзірге оқушының құрылғысында сақталады (басқа құрылғыда көрінбейді).
- ҰБТ симуляциясы әлі ескі 10 нұсқамен істейді (оның жауаптары қолданба кодында тұр).
- Суреттер (теориядағы) ашық мекенжайда тұр; мәтін мен тест жауаптары қорғалған.
- Рейтинг беті басқа оқушылардың деректерін көрсетпейді (құпиялылық үшін).
- AI-мұғалім Vercel-де істемейді.

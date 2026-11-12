#!/usr/bin/env python3
"""
Теория мен тесттерді (жауаптарымен) Supabase-ке жүктейді.
Қолдану (өз компьютеріңізде, терминалда):
    export SUPABASE_URL=https://XXXX.supabase.co
    export SUPABASE_SERVICE_KEY=<service_role кілті>     # ҚҰПИЯ! GitHub-қа салмаңыз, Vercel-ге қоспаңыз
    python3 tools/upload_content.py            # бәрін жүктеу
    python3 tools/upload_content.py --dry-run  # тек тексеру, жүктемейді
Windows PowerShell:  $env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_KEY="..."
Қайта іске қоссаңыз, бар жазбалар жаңартылады (қайталанбайды).
"""
import json, os, sys, glob, urllib.request, urllib.error, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRY = "--dry-run" in sys.argv
URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not DRY and (not URL or not KEY):
    sys.exit("SUPABASE_URL және SUPABASE_SERVICE_KEY орта айнымалылары керек (файлдың басындағы нұсқаулықты қараңыз).")

def post(table, rows, conflict):
    body = json.dumps(rows, ensure_ascii=False).encode("utf-8")
    if DRY:
        return len(body)
    req = urllib.request.Request(
        f"{URL}/rest/v1/{table}?on_conflict={conflict}", data=body, method="POST",
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"})
    for attempt in range(3):
        try:
            urllib.request.urlopen(req, timeout=120).read()
            return len(body)
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "replace")[:300]
            if e.code in (401, 403): sys.exit(f"Рұқсат жоқ ({e.code}). service_role кілтін тексеріңіз: {msg}")
            if attempt == 2: sys.exit(f"{table}: HTTP {e.code} {msg}")
        except Exception as e:
            if attempt == 2: sys.exit(f"{table}: {e}")
        time.sleep(2)

def batches(rows, max_bytes=1_200_000, max_rows=50):
    cur, size = [], 0
    for r in rows:
        n = len(json.dumps(r, ensure_ascii=False).encode("utf-8"))
        if cur and (size + n > max_bytes or len(cur) >= max_rows):
            yield cur; cur, size = [], 0
        cur.append(r); size += n
    if cur: yield cur

# 1) Тесттер
tests = json.load(open(os.path.join(ROOT, "server_data/tests.json"), encoding="utf-8"))
rows = [{"test_id": k, **v} for k, v in tests.items()]
sent = 0
for b in batches(rows): sent += post("test_bank", b, "test_id")
print(f"Тест: {len(rows)} жазба {'тексерілді' if DRY else 'жүктелді'} ({sent // 1024} КБ)")

# 2) Теория
rows = []
for f in sorted(glob.glob(os.path.join(ROOT, "server_data/theory/ch*.json")), key=lambda p: int(os.path.basename(p)[2:-5])):
    for lid, html in json.load(open(f, encoding="utf-8"))["lessons"].items():
        rows.append({"lesson_id": lid, "html": html})
sent = 0
for b in batches(rows, max_bytes=800_000, max_rows=20): sent += post("theory_bank", b, "lesson_id")
print(f"Теория: {len(rows)} сабақ {'тексерілді' if DRY else 'жүктелді'} ({sent // 1048576} МБ)")
print("Дайын." if not DRY else "Dry-run аяқталды.")

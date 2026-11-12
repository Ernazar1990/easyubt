#!/usr/bin/env python3
"""
Тест Markdown файлдарынан (chemistry_test_NN.md) платформа тесттерін және course data жасайды.
Қолдану: python3 tools/build_tests.py <тест md қалтасы>
Шығады: server_data/tests.json (сұрақтар + жауаптар, серверге жүктеледі), src/courseData.js (тарау/сабақ тізімі), src/courseTests.js (бос — қолданбада жауап қалмайды)
"""
import os, re, sys, json, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MD_DIR = sys.argv[1] if len(sys.argv) > 1 else "tests_md"
S = "ABCDEF"
MATH_RE = re.compile(r"\$\$.+?\$\$|\$[^$\n]+?\$", re.S)
ESC_RE = re.compile(r"\\([\\`*_{}\[\]()#+\-.!|<>~$])")

def unesc(t):
    out, last = [], 0
    for m in MATH_RE.finditer(t):
        out.append(ESC_RE.sub(r"\1", t[last:m.start()])); out.append(m.group(0)); last = m.end()
    out.append(ESC_RE.sub(r"\1", t[last:]))
    return "".join(out).strip()

def split_blocks(sec):
    parts = re.split(r"^## (\d+)\.\s*", sec, flags=re.M)
    head = parts[0]; blocks = {}
    for i in range(1, len(parts), 2): blocks[int(parts[i])] = parts[i + 1]
    return head, blocks

def parse_opts(block, letters=S):
    lines = block.split("\n"); q = []; opts = []
    for ln in lines:
        m = re.match(r"^\s*([A-F])\\\)\s*(.*?)\s*$", ln)
        if m: opts.append((m.group(1), m.group(2)))
        elif re.match(r"^\s*(\d)\\\)\s*(.*?)\s*$", ln): opts.append((re.match(r"^\s*(\d)", ln).group(1), re.match(r"^\s*\d\\\)\s*(.*?)\s*$", ln).group(1)))
        elif not opts: q.append(ln)
    return unesc("\n".join(q)), opts

def parse_key(text):
    key = {}
    for m in re.finditer(r"(?<!\d)(\d{1,2})\s*—\s*([^;\n]+)", text):
        key[int(m.group(1))] = m.group(2).strip().rstrip(".").strip()
    return key

def parse_file(path):
    t = open(path, encoding="utf-8").read()
    t = re.sub(r"^---.*?---\s*", "", t, flags=re.S)
    sub = re.search(r"^\*\*(?!40 тапсырма)(.+?)\*\*\s*$", t, flags=re.M)
    subtitle = sub.group(1).strip() if sub else ""
    secs = re.split(r"^# (.+)$", t, flags=re.M)
    sections = {secs[i].strip(): secs[i + 1] for i in range(1, len(secs), 2)}
    def sec(prefix):
        for k, v in sections.items():
            if k.lower().startswith(prefix.lower()): return v
        raise KeyError(prefix)
    key = parse_key(sec("Жауап кілті"))
    out = {"subtitle": subtitle, "single": [], "context": None, "match": [], "multi": []}
    # 1–25
    _, bl = split_blocks(sec("Бір дұрыс жауап"))
    assert sorted(bl) == list(range(1, 26)), (path, sorted(bl))
    for n in range(1, 26):
        q, o = parse_opts(bl[n]); assert len(o) == 4, (path, n, len(o))
        out["single"].append({"n": n, "q": q, "opts": [x[1] for x in o], "ans": S.index(key[n])})
    # 26–30
    head, bl = split_blocks(sec("Мәнмәтін"))
    ctx = re.sub(r"Келесі бес тапсырманы осы мәнмәтін бойынша орындаңыз\.?", "", head)
    ctx = unesc(ctx)
    assert sorted(bl) == list(range(26, 31)), (path, sorted(bl)); qs = []
    for n in range(26, 31):
        q, o = parse_opts(bl[n]); assert len(o) == 4, (path, n)
        qs.append({"n": n, "q": q, "opts": [x[1] for x in o], "ans": S.index(key[n])})
    out["context"] = {"text": ctx, "qs": qs}
    # 31–35 сәйкестендіру: A,B тармақтары, 1–4 нұсқалары
    _, bl = split_blocks(sec("Сәйкестендіру"))
    assert sorted(bl) == list(range(31, 36)), (path, sorted(bl))
    for n in range(31, 36):
        blk = bl[n]; q = []; items = []; rights = []
        for ln in blk.split("\n"):
            m1 = re.match(r"^\s*([AB])\\\)\s*(.*?)\s*$", ln); m2 = re.match(r"^\s*(\d)\\\)\s*(.*?)\s*$", ln)
            if m1: items.append(unesc(m1.group(2)))
            elif m2: rights.append(unesc(m2.group(2)))
            elif not items and not rights: q.append(ln)
        assert len(items) == 2 and len(rights) == 4, (path, n, len(items), len(rights))
        pairs = {}
        for part in key[n].split(","):
            m = re.match(r"\s*([AB])\s*[–-]\s*(\d)", part); assert m, (path, n, key[n])
            pairs[m.group(1)] = int(m.group(2)) - 1
        out["match"].append({"n": n, "q": unesc("\n".join(q)), "pairs": [{"left": items[0], "right": rights[pairs["A"]]}, {"left": items[1], "right": rights[pairs["B"]]}], "rights": rights, "labels": "num"})
    # 36–40
    _, bl = split_blocks(sec("Бір немесе бірнеше"))
    assert sorted(bl) == list(range(36, 41)), (path, sorted(bl))
    for n in range(36, 41):
        q, o = parse_opts(bl[n]); assert len(o) == 6, (path, n, len(o))
        ans = [S.index(x.strip()) for x in key[n].split(",")]
        assert 1 <= len(ans) <= 3, (path, n, ans)
        out["multi"].append({"n": n, "q": q, "opts": [unesc(x[1]) for x in o], "ans_all": ans})
    for it in out["single"] + out["context"]["qs"]: it["opts"] = [unesc(x) for x in it["opts"]]
    return out

def main():
    files = sorted(glob.glob(os.path.join(MD_DIR, "chemistry_test_*.md")))
    tests = {}; order = {}
    for f in files:
        m = re.match(r"chemistry_test_(\d+)(?:_(\d+))?\.md", os.path.basename(f))
        n, part = int(m.group(1)), m.group(2)
        lid = f"chem_c{n}_{part}_review" if part else f"chem_c{n}_review"
        d = parse_file(f); d["replace"] = True; d["minutes"] = 60; d["chapter"] = n; d["part"] = int(part) if part else None
        tests[lid] = d; order.setdefault(n, []).append(lid)
    ch = json.load(open(os.path.join(ROOT, "tools/.chapters.json"), encoding="utf-8"))
    chapters = []
    for c in ch:
        n = c["n"]; lessons = []
        for l in c["lessons"]:
            e = {"id": l["id"], "title": l["title"], "duration": f"{l['min']} мин", "videoUrl": "", "pdfUrl": "", "description": ""}
            if l["id"] in (f"chem_c1_intro", "chem_c1_t1"): e["isFree"] = True
            lessons.append(e)
        for lid in order.get(n, []):
            d = tests[lid]
            title = f"{n}-тарау қорытынды тесті" if d["part"] is None else f"{n}-тарау · {d['part']}-тақырыптық тест: {d['subtitle']}"
            lessons.append({"id": lid, "title": title + " (40 тапсырма / 50 балл)", "duration": "60 мин", "videoUrl": "", "pdfUrl": "", "description": ""})
        chapters.append({"id": f"chem_t{n}", "title": f"{n}-тарау. {c['title']}", "lessons": lessons})
    js = "// АВТОМАТТЫ ТҮРДЕ ЖАСАЛҒАН (tools/build_content.py + tools/build_tests.py). Қолмен өзгертпеңіз.\n"
    open(os.path.join(ROOT, "src/courseData.js"), "w", encoding="utf-8").write(js + "export const COURSE_CHAPTERS = " + json.dumps(chapters, ensure_ascii=False) + ";\n")
    server = {}
    for tid, d in tests.items():
        pub, key = [], []
        for q in d["single"]:
            pub.append({"id": f"{tid}_q{q['n']}", "kind": "single", "n": q["n"], "q": q["q"], "opts": q["opts"]}); key.append({"kind": "single", "ans": q["ans"]})
        for q in d["context"]["qs"]:
            pub.append({"id": f"{tid}_q{q['n']}", "kind": "context", "n": q["n"], "q": q["q"], "opts": q["opts"], "ctx": d["context"]["text"]}); key.append({"kind": "context", "ans": q["ans"]})
        for q in d["match"]:
            rights = q["rights"]; assert len(set(rights)) == len(rights), (tid, q["n"], "қайталанатын нұсқа")
            pub.append({"id": f"{tid}_q{q['n']}", "kind": "match", "n": q["n"], "q": q["q"], "lefts": [p["left"] for p in q["pairs"]], "rights": rights, "labels": q.get("labels", "")})
            key.append({"kind": "match", "ans": [rights.index(p["right"]) for p in q["pairs"]]})
        for q in d["multi"]:
            pub.append({"id": f"{tid}_q{q['n']}", "kind": "multi", "n": q["n"], "q": q["q"], "opts": q["opts"]}); key.append({"kind": "multi", "ans_all": q["ans_all"]})
        ch_n = d["chapter"]; part = d["part"]
        title = f"{ch_n}-тарау қорытынды тесті" if part is None else f"{ch_n}-тарау · {part}-тақырыптық тест: {d['subtitle']}"
        server[tid] = {"chapter": ch_n, "title": title, "minutes": 60, "public_json": pub, "key_json": key}
    os.makedirs(os.path.join(ROOT, "server_data"), exist_ok=True)
    json.dump(server, open(os.path.join(ROOT, "server_data/tests.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    open(os.path.join(ROOT, "src/courseTests.js"), "w", encoding="utf-8").write(js + "// Жауаптар қолданбада сақталмайды: тесттер серверден беріледі (server_data/tests.json → tools/upload_content.py).\nexport const FINAL_EXTRA = {};\n")
    tot = sum(len(c["lessons"]) for c in chapters)
    print("тест:", len(tests), "| сабақ (тестпен):", tot, "| tests.json KB:", os.path.getsize(os.path.join(ROOT, "server_data/tests.json")) // 1024)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Word (.docx) тарау файлдарынан платформа контентін жасайды.
Қолдану:  python3 tools/build_content.py <docx қалтасы> <тест md қалтасы>
Керек: pandoc, python3 (beautifulsoup4, Pillow).
Шығады: server_data/theory/chN.json (теория HTML — серверге жүктеледі), public/img/chN/*.webp (суреттер, ашық)
"""
import os, re, sys, json, subprocess, shutil, tempfile
from multiprocessing import Pool
from bs4 import BeautifulSoup
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCX_DIR = sys.argv[1] if len(sys.argv) > 1 else "docx"
MD_DIR = sys.argv[2] if len(sys.argv) > 2 else "tests_md"
TMP = tempfile.mkdtemp(prefix="ubt_")
TITLES = {int(k): v for k, v in json.load(open(os.path.join(ROOT, "tools/chapter_titles.json"), encoding="utf-8")).items()}

TOPIC_RE = re.compile(r"^§\s*(\d+)\.?\s*(.*)$|^(\d+)\s+(\D.*)$")
EXCLUDE_RE = re.compile(r"(жаттығу тесті|бекіту тесті|^тарау тесті|тесті\s*[•—-]|ТАРАУ ТЕСТІ|\d+\s*(қорытынды\s*)?тест|тестінің жауаптары)", re.I)
SUMMARY_RE = re.compile(r"(қорытындысы|дереккөз|қосымша оқу)", re.I)
ANSWERS_RE = re.compile(r"^жауап кілттері", re.I)

def run_pandoc(n):
    out = os.path.join(TMP, f"ch{n}.html")
    subprocess.run(["pandoc", os.path.join(DOCX_DIR, f"chapter{n}.docx"), "-t", "html5", "--wrap=none", "--mathjax",
                    f"--extract-media={os.path.join(TMP, f'm{n}')}", "-o", out], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return n

def conv_img(args):
    src, dst = args
    try:
        im = Image.open(src)
        if im.mode in ("P", "LA"): im = im.convert("RGBA")
        elif im.mode not in ("RGB", "RGBA"): im = im.convert("RGB")
        if im.width > 1000:
            im = im.resize((1000, round(im.height * 1000 / im.width)), Image.LANCZOS)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.save(dst, "WEBP", quality=72, method=4)
        return os.path.getsize(dst)
    except Exception as e:
        print("  сурет қатесі:", src, e); return 0

def norm_title(t):
    t = re.sub(r"\s+", " ", t).strip()
    m = TOPIC_RE.match(t)
    if m:
        num = m.group(1) or m.group(3); rest = (m.group(2) if m.group(1) else m.group(4)) or ""
        return int(num), f"§{num}. {rest.strip()}"
    return None, t

def clean_fragment(els, n, img_jobs):
    html = "".join(str(e) for e in els)
    s = BeautifulSoup(html, "html.parser")
    for tag in s.find_all(["script", "style", "iframe", "object", "embed", "form"]): tag.decompose()
    for tag in s.find_all(True):
        for a in list(tag.attrs):
            if a.startswith("on") or a in ("style", "id", "class") and tag.name != "span" and not (tag.name == "span"):
                if a != "class": del tag.attrs[a]
        if tag.name == "h1": tag.name = "h2"
    for im in s.find_all("img"):
        src = im.get("src", "")
        fn = os.path.basename(src); stem = os.path.splitext(fn)[0]
        found = None
        for root, _, files in os.walk(os.path.join(TMP, f"m{n}")):
            if fn in files: found = os.path.join(root, fn); break
        if not found: im.decompose(); continue
        dst = os.path.join(ROOT, "public/img", f"ch{n}", stem + ".webp")
        img_jobs.append((found, dst))
        im.attrs = {"src": f"/img/ch{n}/{stem}.webp", "alt": im.get("alt", ""), "loading": "lazy"}
    for tb in s.find_all("table"):
        wrap = s.new_tag("div"); wrap["class"] = "ub-tbl"; tb.wrap(wrap)
    return str(s)

def words(html):
    return len(re.sub(r"<[^>]+>", " ", html).split())

def process_chapter(n, img_jobs):
    soup = BeautifulSoup(open(os.path.join(TMP, f"ch{n}.html"), encoding="utf-8").read(), "html.parser")
    secs = []  # (kind, title, [elements])
    pre = []
    cur = None
    for el in soup.find_all(True, recursive=False):
        if el.name == "h1":
            text = el.get_text(" ", strip=True)
            num, nt = norm_title(text)
            if num is not None and re.search(r"тест", text, re.I) and not text.lstrip().startswith("§"):
                cur = ["skip", text, []]; secs.append(cur)   # «50 деңгейлік тест» сияқты ескі тест бөлімдері
            elif num is not None: cur = ["topic", nt, []]; secs.append(cur)
            elif EXCLUDE_RE.search(text) and not ANSWERS_RE.match(text): cur = ["skip", text, []]; secs.append(cur)
            elif ANSWERS_RE.match(text): cur = ["answers", text, []]; secs.append(cur)
            elif SUMMARY_RE.search(text): cur = ["summary", text, []]; secs.append(cur)
            else:
                if cur is None: cur = ["intro", text, []]; secs.append(cur)
                else: cur[2].append(el)  # ішкі H1 — алдыңғы бөлімнің құрамында
            if cur and cur[0] in ("intro",) and cur[2] == [] and text and secs[-1] is cur: pass
        else:
            if cur is None: cur = ["intro", "Кіріспе", []]; secs.append(cur)
            cur[2].append(el)
    lessons = []; html_map = {}
    summary_els = []; answers_els = []; intro_els = []
    k = 0
    for kind, title, els in secs:
        if kind == "topic":
            k += 1
            lid = f"chem_c{n}_t{k}"
            html_map[lid] = clean_fragment(els, n, img_jobs)
            lessons.append({"id": lid, "title": title, "min": max(5, round(words(html_map[lid]) / 140))})
        elif kind == "intro": intro_els += [BeautifulSoup(f"<h2>{title}</h2>", "html.parser")] + els
        elif kind == "summary": summary_els += [BeautifulSoup(f"<h2>{title}</h2>", "html.parser")] + els
        elif kind == "answers":
            # тек деңгейлік тапсырмалардың жауаптары қалады; ескі тест жауаптары алынады
            keep = []; groups = []; head = None
            for e in els:
                if getattr(e, "name", None) == "h2": head = [e, []]; groups.append(head)
                elif head is None: groups.append([None, [e]])
                else: head[1].append(e)
            for h, body in groups:
                htxt = h.get_text(" ", strip=True) if h is not None else ""
                body_txt = " ".join(x.get_text(" ", strip=True) for x in body)[:400]
                if h is None:
                    if re.search(r"деңгейлік", body_txt, re.I): keep += body
                elif re.search(r"деңгейлік|ашық тапсырма|шығару", htxt, re.I) and not re.search(r"тест", htxt, re.I):
                    keep += [h] + body
            if keep: answers_els += keep
    # қосымша сабақтар
    out = []
    if intro_els and words("".join(str(e) for e in intro_els)) > 40:
        html_map[f"chem_c{n}_intro"] = clean_fragment(intro_els, n, img_jobs)
        out.append({"id": f"chem_c{n}_intro", "title": "Тарау кіріспесі және оқу нұсқаулығы", "min": 5})
    out += lessons
    if summary_els:
        html_map[f"chem_c{n}_summary"] = clean_fragment(summary_els, n, img_jobs)
        out.append({"id": f"chem_c{n}_summary", "title": "Тарау қорытындысы және анықтамалық материал", "min": max(5, round(words(html_map[f'chem_c{n}_summary']) / 140))})
    if answers_els and words("".join(str(e) for e in answers_els)) > 25:
        html_map[f"chem_c{n}_answers"] = "<h2>Деңгейлік тапсырмалардың жауаптары</h2>" + clean_fragment([e for e in answers_els if getattr(e, "name", None) != "h1"], n, img_jobs)
        out.append({"id": f"chem_c{n}_answers", "title": "Деңгейлік тапсырмалардың жауаптары", "min": 10})
    return out, html_map

def main():
    print("1/4 pandoc ...")
    with Pool(4) as p: p.map(run_pandoc, range(1, 32))
    img_jobs = []; chapters = []; stats = []
    os.makedirs(os.path.join(ROOT, "server_data/theory"), exist_ok=True)
    print("2/4 бөлу ...")
    for n in range(1, 32):
        lessons, html_map = process_chapter(n, img_jobs)
        json.dump({"lessons": html_map}, open(os.path.join(ROOT, f"server_data/theory/ch{n}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        chapters.append({"n": n, "title": TITLES[n], "lessons": lessons})
        stats.append((n, len(lessons), sum(len(v) for v in html_map.values()) // 1024))
    print("3/4 суреттер:", len(img_jobs))
    if os.path.isdir(os.path.join(ROOT, "public/img")): shutil.rmtree(os.path.join(ROOT, "public/img"))
    uniq = {d: s for s, d in img_jobs}
    with Pool(4) as p: sizes = p.map(conv_img, [(s, d) for d, s in uniq.items()])
    print("   сурет:", len(uniq), "| көлемі:", round(sum(sizes) / 1048576, 1), "МБ")
    json.dump(chapters, open(os.path.join(ROOT, "tools/.chapters.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("4/4 дайын. тарау/сабақ/KB:", stats[:3], "...", "барлық сабақ:", sum(len(c["lessons"]) for c in chapters))
    shutil.rmtree(TMP, ignore_errors=True)

if __name__ == "__main__":
    main()

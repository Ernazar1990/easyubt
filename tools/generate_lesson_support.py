#!/usr/bin/env python3
"""Build source-aligned lesson practice, homework and error-work PDFs.

Usage: python tools/generate_lesson_support.py "E:\\after astra" "E:\\after astra\\chemistry_tests_31_chapters_markdown.zip" --out .tmp/lesson-support
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.sax.saxutils import escape

from docx import Document
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageBreak, PageTemplate, Paragraph as PdfParagraph,
    Spacer, Table as PdfTable, TableStyle,
)


NAVY = colors.HexColor("#172554")
INDIGO = colors.HexColor("#4F46E5")
PALE = colors.HexColor("#EEF2FF")
TEXT = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#64748B")
GREEN = colors.HexColor("#047857")


def inline_text(text: str) -> str:
    text = re.sub(r"\\(?:mathrm|text)\{([^{}]*)\}", r"\1", text)
    text = re.sub(r"\\(?:times|cdot)", "×", text)
    text = re.sub(r"\\(?:rightarrow|to)", "→", text)
    text = re.sub(r"\$+", "", text)
    text = re.sub(r"\\([%_{}])", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def blocks_from_docx(path: Path):
    doc = Document(path)
    body = doc.element.body
    blocks = []
    for child in body.iterchildren():
        if isinstance(child, CT_P):
            p = Paragraph(child, doc)
            text = inline_text(p.text)
            if text:
                blocks.append({"style": p.style.name, "text": text, "table": False})
        elif isinstance(child, CT_Tbl):
            table = Table(child, doc)
            rows = []
            for row in table.rows:
                cells = [inline_text(cell.text) for cell in row.cells]
                if any(cells):
                    rows.append(" | ".join(cells))
            if rows:
                blocks.append({"style": "Table", "text": "\n".join(rows), "table": True})
    return blocks


def parse_course(path: Path):
    raw = path.read_text(encoding="utf-8")
    payload = raw.split("=", 1)[1].strip().rstrip(";")
    chapters = json.loads(payload)
    lessons = []
    for chapter in chapters:
        chapter_no = int(re.search(r"\d+", chapter["id"]).group())
        for lesson in chapter["lessons"]:
            m = re.search(r"§\s*(\d+)", lesson.get("title", ""))
            if not m:
                continue
            lessons.append({
                "chapter": chapter_no, "section": int(m.group(1)),
                "id": lesson["id"], "title": lesson["title"],
                "chapterTitle": chapter["title"],
            })
    return lessons


def theory_sections(source_dir: Path, lessons: list[dict]):
    by_chapter = defaultdict(list)
    for lesson in lessons:
        by_chapter[lesson["chapter"]].append(lesson)
    output = {}
    missing_files = []
    for chapter, chapter_lessons in sorted(by_chapter.items()):
        path = source_dir / f"chapter{chapter}.docx"
        if not path.exists() and chapter == 3:
            path = source_dir / "chapter3..docx"
        if not path.exists():
            missing_files.append(path.name)
            continue
        active = None
        active_lessons = []
        for block in blocks_from_docx(path):
            text, style = block["text"], block["style"]
            is_h1 = style == "Heading 1"
            if is_h1:
                match = re.match(r"^§\s*(\d+)(?:\s*[–—-]\s*(\d+))?|^(\d+)\s+", text)
                if match:
                    section_start = int(match.group(1) or match.group(3))
                    section_end = int(match.group(2) or section_start)
                    active_lessons = [x for x in chapter_lessons if section_start <= x["section"] <= section_end]
                    active = active_lessons[0] if active_lessons else None
                    for target in active_lessons:
                        target.setdefault("blocks", []).append(block)
                    continue
                active = None
                active_lessons = []
            if active:
                for target in active_lessons:
                    target.setdefault("blocks", []).append(block)
    for lesson in lessons:
        lesson_blocks = lesson.pop("blocks", [])
        lesson["theoryBlocks"] = lesson_blocks
        lesson["theory"] = "\n".join(b["text"] for b in lesson_blocks)
        lesson["facts"] = extract_facts(lesson_blocks)
        lesson["objectives"] = extract_heading_content(lesson_blocks, ("Оқу мақсаттары",))
        lesson["definition"] = extract_heading_content(lesson_blocks, ("Негізгі ұғым", "Негізгі түсіндірме"))
        lesson["mistakes"] = extract_mistakes(lesson_blocks)
        output[lesson["id"]] = lesson
    # §119 is intentionally included in the platform but omitted from the main chapter DOCX.
    # Use the clearly marked proposed lesson in the editorial source as the content source.
    if 16 in by_chapter and any(x["section"] == 119 for x in by_chapter[16]):
        editorial = source_dir / "chemistry_book_editorial_review.docx"
        if editorial.exists():
            blocks = blocks_from_docx(editorial)
            start = next((i for i, b in enumerate(blocks) if "18 топ элементтері және химиялық инерттіліктің шегі" in b["text"].lower()), None)
            if start is not None:
                chosen = []
                for b in blocks[start:]:
                    if "Дереккөз А:" in b["text"] or "Басылым алдындағы тексеру реті" in b["text"]:
                        break
                    chosen.append(b)
                target = next(x for x in by_chapter[16] if x["section"] == 119)
                output[target["id"]]["theoryBlocks"] = chosen
                output[target["id"]]["theory"] = "\n".join(b["text"] for b in chosen)
                output[target["id"]]["facts"] = extract_facts(chosen)
                output[target["id"]]["objectives"] = []
                output[target["id"]]["definition"] = []
                output[target["id"]]["mistakes"] = []
    return output, missing_files


def heading_level(style: str):
    m = re.fullmatch(r"Heading (\d+)", style)
    return int(m.group(1)) if m else None


def extract_heading_content(blocks, names):
    start = None
    for i, block in enumerate(blocks):
        if block["text"].strip().lower() in {x.lower() for x in names}:
            start = i
            break
    if start is None:
        return []
    level = heading_level(blocks[start]["style"]) or 2
    out = []
    for block in blocks[start + 1:]:
        other_level = heading_level(block["style"])
        if other_level and other_level <= level:
            break
        if block["text"] and not block["table"]:
            value = re.sub(r"^[•·\-–—*\s]+", "", block["text"]).strip()
            if len(value) >= 12:
                out.append(value)
    return out


def extract_mistakes(blocks):
    for i, block in enumerate(blocks):
        if "жиі кездесетін қателік" not in block["text"].lower():
            continue
        level = heading_level(block["style"]) or 2
        for row in blocks[i + 1:]:
            other = heading_level(row["style"])
            if other and other <= level:
                break
            if not row["table"]:
                continue
            pairs = []
            for line in row["text"].splitlines():
                cells = [c.strip() for c in line.split("|")]
                if len(cells) >= 2 and cells[0] and cells[1]:
                    if "қате" not in cells[0].lower() and "дұрыс" not in cells[1].lower():
                        pairs.append((cells[0], cells[1]))
            if pairs:
                return pairs
    return []


def extract_facts(blocks):
    facts = []
    skip = False
    for block in blocks:
        text = block["text"].strip()
        level = heading_level(block["style"])
        if level and any(x in text.lower() for x in ("деңгейлік тапсырма", "жауап кілті", "тест")):
            skip = True
        elif level and level <= 3 and skip:
            skip = False
        if skip or level or block["table"]:
            continue
        text = re.sub(r"^[•·\-–—*\d.)\s]+", "", text).strip()
        if 35 <= len(text) <= 220 and not text.endswith("?"):
            facts.extend(x.strip() for x in re.split(r"(?<=[.!?])\s+", text) if 28 <= len(x.strip()) <= 200)
    # Keep source order, remove duplicates and boilerplate.
    out = []
    for fact in facts:
        fact = inline_text(fact)
        if fact not in out and not re.search(r"(оқу мақсаты|тапсырма|жауап кілті|дұрыс жауап)", fact, re.I):
            out.append(fact)
    return out


def parse_test_md(name: str, text: str):
    chapter = int(re.search(r"chemistry_test_(\d+)", name).group(1))
    variant_m = re.search(r"chemistry_test_\d+_(\d+)", name)
    variant = int(variant_m.group(1)) if variant_m else 0
    key_start = text.rfind("# Жауап кілті")
    key_lines = text[key_start:].splitlines() if key_start >= 0 else []
    keys = {}
    for line in key_lines:
        for part in line.split(";"):
            m = re.match(r"\s*(\d{1,2})\s*[—–-]\s*(.+?)\s*\.?\s*$", part)
            if m:
                keys[int(m.group(1))] = m.group(2).strip()
    q_matches = list(re.finditer(r"(?m)^#{2,3}\s+(\d+)(?:\.\s*|\s*$)([^\n]*)\n", text))
    context = ""
    contexts = list(re.finditer(r"(?im)^#\s*(?:мәнмәтіндік тапсырмалар|мәнмәтін|контекст)[^\n]*\n", text))
    q_by_no = {}
    for ix, match in enumerate(q_matches):
        no = int(match.group(1))
        end = q_matches[ix + 1].start() if ix + 1 < len(q_matches) else (key_start if key_start >= 0 else len(text))
        body = text[match.end():end]
        title = match.group(2).strip()
        lines = [x.strip() for x in body.splitlines() if x.strip()]
        while lines and lines[0].startswith("#"):
            lines.pop(0)
        options = {}
        for letter, option in re.findall(r"(?m)^([A-F])\\\)\s*(.+?)\s*$", body):
            options[letter] = inline_text(option)
        numbered = {}
        for number, option in re.findall(r"(?m)^(\d+)\\\)\s*(.+?)\s*$", body):
            numbered[int(number)] = inline_text(option)
        if not title and lines:
            title = inline_text(lines[0])
        q = {"file": name, "chapter": chapter, "variant": variant, "n": no,
             "q": inline_text(title), "kind": "single", "opts": options,
             "ctx": "", "lefts": [], "rights": [], "pairs": [], "ans_all": []}
        if no in range(26, 31):
            q["kind"] = "context"
            candidate = next((c for c in reversed(contexts) if c.start() < match.start()), None)
            if candidate:
                ctx_text = text[candidate.end():match.start()]
                ctx_text = re.sub(r"(?m)^Келесі бес тапсырманы.*$", "", ctx_text).strip()
                q["ctx"] = inline_text(" ".join(ctx_text.splitlines()))
        elif no in range(31, 36):
            q["kind"] = "match"
            q["lefts"] = [options[k] for k in sorted(options)]
            q["rights"] = [numbered[k] for k in sorted(numbered)]
            key = keys.get(no, "")
            q["pairs"] = [(ord(left) - 65, int(right) - 1) for left, right in re.findall(r"([A-F])\s*[–—-]\s*(\d+)", key)]
        elif no in range(36, 41):
            q["kind"] = "multi"
            key = keys.get(no, "")
            q["ans_all"] = [ord(letter) - 65 for letter in re.findall(r"[A-F]", key)]
        q["key"] = keys.get(no, "")
        q_by_no[no] = q
    return {"file": name, "chapter": chapter, "variant": variant, "questions": q_by_no}


STOP = set("және мен немесе үшін бойынша деген қандай қалай қайсысы қай кезде не болып табылады анықтаңыз көрсетіңіз таңдаңыз дұрыс негізгі тақырып тақырыбы химия химиялық зат заттар сабақ бойынша кезде арқылы керек тиіс алады болуы".split())
SUFFIXES = sorted("ларымыздың леріміздің ларындағы леріндегі ларының лерінің ларымен лерімен ларға лерге ларды лерді тардың тердің дардың дердің лары лері ның нің дың дің ға ге қа ке лық лік дық дік тық тік тары тері лар лер тар тер дан ден нан нен мен пен бен да де та те ды ді ты ті ы і с".split(), key=len, reverse=True)


def tokens(text: str):
    text = re.sub(r"\\(?:mathrm|text)\{([^{}]*)\}", r"\1", text.lower())
    out = set()
    for word in re.findall(r"[a-zа-яәіңғүұқөһ]+|[0-9]+", text):
        if len(word) < 3 or word in STOP:
            continue
        for suffix in SUFFIXES:
            if len(word) - len(suffix) >= 4 and word.endswith(suffix):
                word = word[:-len(suffix)]
                break
        if len(word) >= 3 and word not in STOP:
            out.add(word)
    return out


def source_q_text(q):
    pieces = [q["q"], q.get("ctx", "")]
    if q["kind"] == "match":
        pieces += q["lefts"] + q["rights"]
    elif q["kind"] == "multi":
        pieces += [q["opts"].get(chr(65 + i), "") for i in q["ans_all"]]
    else:
        letters = re.findall(r"[A-D]", q.get("key", ""))
        if letters:
            pieces.append(q["opts"].get(letters[0], ""))
    return " ".join(pieces)


def answer_index(q):
    if q["kind"] in ("single", "context"):
        letter = re.match(r"\s*([A-D])", q.get("key", ""))
        return ord(letter.group(1)) - 65 if letter else None
    if q["kind"] == "multi":
        return q["ans_all"]
    return q["pairs"]


def build_question(q, lesson, generated=False, number=0):
    item = {"id": f"{lesson['id']}_{'source' if not generated else 'theory'}_{number}_{q.get('n', 0)}",
            "q": q["q"], "exp": q.get("exp", ""), "topic": lesson["title"]}
    if q["kind"] in ("single", "context"):
        opts = [q["opts"].get(chr(65 + i), "") for i in range(4)]
        key = q.get("key", "")
        m = re.match(r"\s*([A-D])", key)
        if m is None:
            raise ValueError(f"No single-answer key: {q['file']} Q{q['n']}")
        item.update({"opts": opts, "ans": ord(m.group(1)) - 65})
        if q["kind"] == "context" and q.get("ctx"):
            item.update({"type": "context", "ctx": q["ctx"]})
    elif q["kind"] == "match":
        if len(q["lefts"]) < 2 or not q["pairs"]:
            raise ValueError(f"Bad matching source: {q['file']} Q{q['n']}")
        rights = q["rights"]
        pairs = [{"left": q["lefts"][li], "right": rights[ri]} for li, ri in q["pairs"]]
        item.update({"type": "match", "pairs": pairs, "rights": rights})
    else:
        if not q["ans_all"]:
            raise ValueError(f"No multi answer key: {q['file']} Q{q['n']}")
        opts = [q["opts"].get(chr(65 + i), "") for i in range(6)]
        item.update({"type": "multi", "multi": True, "opts": opts,
                     "ans_all": q["ans_all"], "ans": q["ans_all"][0]})
    item["exp"] = (f"Дұрыс жауап: {q.get('key','')}. Бұл сұрақ тарау соңындағы тесттен алынды. "
                   f"Теория: {lesson['title']}.")
    return item


def answer_text(q):
    if q["kind"] in ("single", "context"):
        letter = re.match(r"\s*([A-D])", q.get("key", ""))
        if not letter:
            return "", ""
        key = letter.group(1)
        choices = "\n".join(f"{k}) {v}" for k, v in q["opts"].items())
        prompt = (f"{q.get('ctx','')}\n" if q.get("ctx") else "") + f"{q['q']}\n{choices}\nЖауап әрпін жазыңыз."
        return prompt.strip(), key
    if q["kind"] == "match":
        pairs = ", ".join(f"{chr(65+li)}-{ri+1}" for li, ri in q["pairs"])
        lefts = "\n".join(f"{chr(65+i)}) {v}" for i, v in enumerate(q["lefts"]))
        rights = "\n".join(f"{i+1}) {v}" for i, v in enumerate(q["rights"]))
        return f"{q['q']}\n{lefts}\n{rights}\nЖауап үлгісі: A-1, B-3", pairs
    letters = [chr(65 + i) for i in q["ans_all"]]
    choices = "\n".join(f"{k}) {v}" for k, v in q["opts"].items())
    return f"{q['q']}\n{choices}\nДұрыс жауап әріптерін жазыңыз.", ", ".join(letters)


def facts_for(lesson):
    facts = lesson["facts"][:]
    if lesson["objectives"]:
        facts += lesson["objectives"]
    facts = [inline_text(x) for x in facts]
    # Prefer specific facts, equations, quantities, and named concepts.
    facts.sort(key=lambda x: (0 if re.search(r"(?:→|=|\b(?:H|O|Na|Cl|Ca|Fe|C|N|S|Mg|Al)[A-Za-z0-9₀-₉]*)", x) else 1, abs(115 - len(x))))
    return list(dict.fromkeys(x for x in facts if 28 <= len(x) <= 200))


def generated_questions(lesson, all_lessons, count=8):
    own = facts_for(lesson)
    peers = [x for x in all_lessons if x["chapter"] == lesson["chapter"] and x["id"] != lesson["id"]]
    peer_facts = []
    for peer in peers:
        for fact in facts_for(peer):
            if fact not in peer_facts:
                peer_facts.append(fact)
    if not own:
        own = [f"{lesson['title']} тақырыбында осы ұғымның анықтамасын, қасиетін және қолданылуын теориямен салыстырып түсіндіріңіз."]
    out = []
    for i in range(count):
        correct = own[i % len(own)]
        distractors = [x for x in peer_facts if x != correct and x not in own]
        if len(distractors) < 3:
            distractors = [f"{peer['title']} тақырыбына қатысты тұжырым." for peer in peers if peer["title"] != lesson["title"]]
        opts = [correct] + distractors[:3]
        while len(opts) < 4:
            opts.append(f"{lesson['chapterTitle']} тарауына қатысы жоқ тұжырым.")
        seed = int(hashlib.sha256(f"{lesson['id']}:{i}".encode()).hexdigest()[:8], 16)
        opts = list(dict.fromkeys(opts))
        while len(opts) < 4:
            opts.append(f"Бұл жауап {lesson['chapterTitle']} тарауындағы басқа ұғымға қатысты.")
        opts = opts[:4]
        # Deterministic shuffle; keep correct answer index.
        ordered = sorted(enumerate(opts), key=lambda item: hashlib.sha256(f"{seed}:{item[0]}".encode()).hexdigest())
        shuffled = [v for _, v in ordered]
        ans = next(i for i, value in enumerate(shuffled) if value == correct)
        out.append({
            "id": f"{lesson['id']}_theory_{i+1}",
            "q": f"«{lesson['title']}» теориясында берілген тұжырымды таңдаңыз.",
            "opts": shuffled, "ans": ans,
            "exp": f"Тұжырым осы сабақтың теориялық мәтінінен алынды. Дереккөз: {lesson['title']}.",
            "topic": lesson["title"],
        })
    return out


def display_question(q):
    parts = []
    if q.get("ctx"):
        parts.append(f"<b>Мәнмәтін:</b> {escape(q['ctx'])}")
    parts.append(f"<b>{escape(q['q'])}</b>")
    if q["kind"] in ("single", "context", "multi"):
        for letter, value in q["opts"].items():
            parts.append(f"<br/>{letter}) {escape(value)}")
    else:
        for i, value in enumerate(q["lefts"]):
            parts.append(f"<br/>{chr(65+i)}) {escape(value)}")
        parts.append("<br/><b>Нұсқалар:</b>")
        for i, value in enumerate(q["rights"]):
            parts.append(f"<br/>{i+1}) {escape(value)}")
    return "".join(parts)


def answer_for_pdf(q):
    if q["kind"] in ("single", "context"):
        return q.get("key", "")
    if q["kind"] == "match":
        return "; ".join(f"{chr(65+li)}-{ri+1}" for li, ri in q["pairs"])
    return ", ".join(chr(65+i) for i in q["ans_all"])


def styles():
    sample = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("UbTitle", parent=sample["Title"], fontName="Arial-Bold", fontSize=20, leading=24, textColor=NAVY, spaceAfter=6),
        "subtitle": ParagraphStyle("UbSub", parent=sample["Normal"], fontName="Arial", fontSize=10, leading=14, textColor=MUTED, spaceAfter=8),
        "h": ParagraphStyle("UbH", parent=sample["Heading2"], fontName="Arial-Bold", fontSize=13, leading=16, textColor=INDIGO, spaceBefore=8, spaceAfter=5),
        "body": ParagraphStyle("UbBody", parent=sample["BodyText"], fontName="Arial", fontSize=10, leading=14, textColor=TEXT, spaceAfter=5),
        "small": ParagraphStyle("UbSmall", parent=sample["BodyText"], fontName="Arial", fontSize=8.7, leading=12, textColor=MUTED, spaceAfter=4),
        "center": ParagraphStyle("UbCenter", parent=sample["BodyText"], fontName="Arial-Bold", fontSize=10, leading=14, alignment=TA_CENTER, textColor=NAVY),
    }


class WorksheetDoc(BaseDocTemplate):
    def __init__(self, filename, lesson, **kwargs):
        super().__init__(filename, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=19*mm, bottomMargin=17*mm, **kwargs)
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="normal")
        self.addPageTemplates([PageTemplate(id="worksheet", frames=frame, onPage=self.draw_footer)])
        self.lesson = lesson

    def draw_footer(self, canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#E2E8F0"))
        canvas.line(self.leftMargin, 13*mm, A4[0]-self.rightMargin, 13*mm)
        canvas.setFont("Arial", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(self.leftMargin, 8.5*mm, "EasyUBT · Қатемен жұмыс")
        canvas.drawRightString(A4[0]-self.rightMargin, 8.5*mm, f"§{self.lesson['section']} · {doc.page}")
        canvas.restoreState()


def make_pdf(path: Path, lesson, source_q, mistake, facts):
    styleset = styles()
    story = [
        PdfParagraph("EASYUBT · ЖЕКЕ ҚАЙТАЛАУ ПАРАҒЫ", styleset["subtitle"]),
        PdfParagraph(escape(lesson["title"]), styleset["title"]),
        PdfParagraph(escape(lesson["chapterTitle"]), styleset["subtitle"]),
    ]
    student = PdfTable([["Оқушының аты-жөні: __________________________________", "Күні: ______________"]], colWidths=[113*mm, 45*mm])
    student.setStyle(TableStyle([("BACKGROUND", (0,0),(-1,-1), PALE), ("BOX", (0,0),(-1,-1), 0.5, colors.HexColor("#CBD5E1")), ("PADDING", (0,0),(-1,-1), 8), ("FONTNAME", (0,0),(-1,-1), "Arial"), ("FONTSIZE", (0,0),(-1,-1), 8.5)]))
    story += [student, Spacer(1, 5*mm), PdfParagraph("1. Қате кеткен тест сұрағын қайта орында", styleset["h"])]
    story.append(PdfParagraph(display_question(source_q), styleset["body"]))
    story.append(PdfParagraph("Жауабым: ______________________________________________________________", styleset["body"]))
    story.append(PdfParagraph("Неге осы жауапты таңдадым?", styleset["body"]))
    story.extend([PdfParagraph("________________________________________________________________________________", styleset["body"]) for _ in range(2)])
    story.append(PdfParagraph("2. Қате түсінікті түзет", styleset["h"]))
    if mistake:
        story.append(PdfParagraph(f"<b>Жиі кездесетін қате:</b> {escape(mistake[0])}", styleset["body"]))
        story.append(PdfParagraph(f"<b>Дұрыс қағида:</b> {escape(mistake[1])}", styleset["body"]))
    else:
        fact = facts[0] if facts else lesson["title"]
        story.append(PdfParagraph(f"<b>Теориядағы негізгі қағида:</b> {escape(fact)}", styleset["body"]))
    story.append(PdfParagraph("Өз сөзіңмен түсіндір:", styleset["body"]))
    story.extend([PdfParagraph("________________________________________________________________________________", styleset["body"]) for _ in range(2)])
    story.append(PdfParagraph("3. Қатемді талда", styleset["h"]))
    story.append(PdfParagraph("Мен шатастырған ұғым: ________________________________________________________", styleset["body"]))
    story.append(PdfParagraph("Қайта қолданатын ереже/формула: _______________________________________________", styleset["body"]))
    story.append(PdfParagraph("Келесіде тексеретін қадамым: ___________________________________________________", styleset["body"]))
    story.append(PageBreak())
    story += [
        PdfParagraph("ӨЗІН-ӨЗІ ТЕКСЕРУ", styleset["title"]),
        PdfParagraph(escape(lesson["title"]), styleset["subtitle"]),
        PdfParagraph("Тест сұрағының жауап кілті", styleset["h"]),
        PdfParagraph(f"{source_q['n']}-сұрақ: <b>{escape(answer_for_pdf(source_q))}</b>", styleset["body"]),
        PdfParagraph(escape(source_q.get("exp", "")), styleset["small"]),
        PdfParagraph("Тақырыпты бекітетін негізгі ой", styleset["h"]),
    ]
    story.append(PdfParagraph(escape(facts[0] if facts else lesson["title"]), styleset["body"]))
    if mistake:
        story.append(PdfParagraph("Қате мен дұрыстың айырмасы", styleset["h"]))
        story.append(PdfParagraph(f"{escape(mistake[0])} → {escape(mistake[1])}", styleset["body"]))
    story += [Spacer(1, 10*mm), PdfParagraph("Қайталау жоспары", styleset["h"]),
              PdfParagraph("□ Теорияны қайта оқыдым　 □ Формула/терминді қайталадым　 □ Ұқсас сұрақты қайта шештім", styleset["body"])]
    doc = WorksheetDoc(str(path), lesson)
    doc.build(story)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source_dir", type=Path)
    ap.add_argument("tests_zip", type=Path)
    ap.add_argument("--out", type=Path, default=Path(".tmp/lesson-support"))
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[1]
    lessons = parse_course(root / "src/courseData.js")
    if len(lessons) != 224:
        raise SystemExit(f"Expected 224 numbered lesson topics, found {len(lessons)}")
    lesson_map, missing_files = theory_sections(args.source_dir, lessons)
    missing_theory = [x["id"] for x in lessons if not lesson_map[x["id"]]["theory"].strip()]
    if missing_theory:
        raise SystemExit(f"Theory source is missing for {len(missing_theory)} lessons: {missing_theory[:10]}")
    test_archive = zipfile.ZipFile(args.tests_zip)
    tests = [parse_test_md(name, test_archive.read(name).decode("utf-8", "replace"))
             for name in test_archive.namelist() if name.endswith(".md") and name != "READ_ME.md"]
    structural = []
    all_questions = []
    for test in tests:
        expected = set(range(1, 41))
        got = set(test["questions"])
        missing = sorted(expected - got)
        bad = []
        for no, q in test["questions"].items():
            if no <= 30 and (len(q["opts"]) != 4 or answer_index(q) is None): bad.append(no)
            if 31 <= no <= 35 and (len(q["lefts"]) < 2 or len(q["rights"]) < 3 or len(q["pairs"]) != len(q["lefts"])): bad.append(no)
            if 36 <= no <= 40 and (len(q["opts"]) < 4 or not q["ans_all"] or any(x >= len(q["opts"]) for x in q["ans_all"])): bad.append(no)
            if no not in test["questions"] or not q["key"]: bad.append(no)
            q["test_id"] = f"chem_c{test['chapter']}{('_'+str(test['variant'])) if test['variant'] else ''}_review"
            q["title"] = test["file"]
            all_questions.append(q)
        structural.append({"file": test["file"], "questions": len(got), "missing": missing, "bad": sorted(set(bad))})
    errors = [x for x in structural if x["questions"] != 40 or x["missing"] or x["bad"]]
    if errors:
        raise SystemExit(f"Chapter-test structure/key issue: {errors[:5]}")
    if len(tests) != 35 or len(all_questions) != 1400:
        raise SystemExit(f"Expected 35 x 40 chapter questions; got {len(tests)} files and {len(all_questions)} questions")

    by_chapter = defaultdict(list)
    for lesson in lessons:
        by_chapter[lesson["chapter"]].append(lesson_map[lesson["id"]])
    for lesson in lessons:
        lesson_map[lesson["id"]]["terms"] = tokens(lesson["title"] + " " + lesson_map[lesson["id"]]["theory"])
    for q in all_questions:
        q["terms"] = tokens(source_q_text(q))
    # Information-weighted lexical alignment: question wording is compared against the full source lesson theory.
    alignment = Counter()
    low_alignment = []
    q_by_chapter = defaultdict(list)
    for q in all_questions:
        q_by_chapter[q["chapter"]].append(q)
    for chapter, topics in by_chapter.items():
        all_terms = [t["terms"] for t in topics] + [q["terms"] for q in q_by_chapter[chapter]]
        df = Counter(t for terms in all_terms for t in terms)
        n_docs = len(all_terms)
        idf = {t: math.log(1 + n_docs / (1 + freq)) for t, freq in df.items()}
        edges = []
        for q in q_by_chapter[chapter]:
            qterms = q["terms"]
            ranked = []
            for lesson in topics:
                tterms = lesson["terms"]
                denom = sum(idf.get(t, 0) for t in qterms) or 1
                score = sum(idf.get(t, 0) for t in qterms & tterms) / denom
                # Explicit chapter 31 test variants are dedicated to one of §§221–224.
                if chapter == 31 and q["variant"] and lesson["section"] == 220 + q["variant"]:
                    score += 1.0
                ranked.append((score, lesson))
            ranked.sort(key=lambda row: row[0], reverse=True)
            q["ranked"] = [(round(score, 4), lesson["id"]) for score, lesson in ranked[:4]]
            edges.append((ranked[0][0] if ranked else 0, q, ranked))
        # Greedy highest-confidence one-to-one assignment; no chapter question is duplicated across lessons.
        assigned = defaultdict(list)
        used = set()
        for _, q, ranked in sorted(edges, key=lambda item: item[0], reverse=True):
            for score, lesson in ranked:
                if q["file"] + str(q["n"]) in used: break
                if score < 0.06: break
                if len(assigned[lesson["id"]]) < 3:
                    assigned[lesson["id"]].append((score, q))
                    used.add(q["file"] + str(q["n"]))
                    break
        # Fill any remaining slots with the best unassigned question in the same chapter and flag weak matches.
        for lesson in topics:
            lesson["sourceQs"] = sorted(assigned[lesson["id"]], key=lambda row: row[0], reverse=True)
            while len(lesson["sourceQs"]) < 3:
                candidates = [(score, q) for _, q, ranked in edges if q["file"] + str(q["n"]) not in used
                              for score, candidate in ranked if candidate["id"] == lesson["id"]]
                if not candidates:
                    break
                score, q = max(candidates, key=lambda row: row[0])
                lesson["sourceQs"].append((score, q)); used.add(q["file"] + str(q["n"]))
            lesson["sourceQs"].sort(key=lambda row: row[0], reverse=True)
            alignment[chapter] += sum(score >= 0.10 for score, _ in lesson["sourceQs"])
            if len(lesson["sourceQs"]) < 3 or any(score < 0.10 for score, _ in lesson["sourceQs"]):
                low_alignment.append({"id": lesson["id"], "title": lesson["title"], "matches": [(round(s, 2), q["file"], q["n"]) for s, q in lesson["sourceQs"]]})

    for lesson in lessons:
        data = lesson_map[lesson["id"]]
        matched = data.get("sourceQs", [])
        data["avgSourceScore"] = round(sum(s for s, _ in matched) / max(1, len(matched)), 3)
        data["sourceQs"] = [q for _, q in matched]
    # Build theory-based questions and PDF assets.
    all_lessons = list(lesson_map.values())
    args.out.mkdir(parents=True, exist_ok=True)
    pdf_dir = root / "public/materials/error-work"
    pdf_dir.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
    pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))
    per_chapter = defaultdict(lambda: {"lessonTests": {}, "hwTests": {}, "writingTasks": {}, "lessonErrorWork": {}})
    pdf_info = []
    source_use = Counter()
    for lesson in lessons:
        data = lesson_map[lesson["id"]]
        generated = generated_questions(data, all_lessons, count=8)
        source = data["sourceQs"]
        # One real chapter-test item anchors each assessment to the final test; theory supplies the rest.
        fixed_source = source[0] if source else None
        hw_source = source[1] if len(source) > 1 else None
        write_source = next((q for q in source[2:] if q["kind"] in ("single", "context")), None)
        if write_source is None:
            write_source = next((q for q in source if q["kind"] in ("single", "context")), None)
        if fixed_source:
            fixed = build_question(fixed_source, lesson, number=1)
            source_use[(fixed_source["file"], fixed_source["n"])] += 1
        else:
            fixed = None
        if hw_source:
            homework = build_question(hw_source, lesson, number=2)
            source_use[(hw_source["file"], hw_source["n"])] += 1
        else:
            homework = None
        fix_bank = ([fixed] if fixed else []) + generated[:(5 - bool(fixed))]
        hw_bank = ([homework] if homework else []) + generated[4:4 + (5 - bool(homework))]
        if len(fix_bank) < 5: fix_bank += generated[:5-len(fix_bank)]
        if len(hw_bank) < 5: hw_bank += generated[-(5-len(hw_bank)):]
        per_chapter[lesson["chapter"]]["lessonTests"][lesson["id"]] = fix_bank[:5]
        per_chapter[lesson["chapter"]]["hwTests"][lesson["id"]] = hw_bank[:5]
        if write_source:
            prompt, answer = answer_text(write_source)
            source_use[(write_source["file"], write_source["n"])] += 1
            writing = [{"id": f"{lesson['id']}_writing_1", "type": "blank", "question": prompt,
                        "answer": answer, "hint": "Сұрақты оқып, дұрыс жауапты нұсқалардан табыңыз.",
                        "source": write_source["file"] + f" · {write_source['n']}-сұрақ"}]
        else:
            fact = (data["facts"] or data["objectives"] or [lesson["title"]])[0]
            writing = [{"id": f"{lesson['id']}_writing_1", "type": "term",
                        "question": f"{lesson['title']} тақырыбын теориядан оқып, негізгі тұжырымды қысқаша жазыңыз.",
                        "answer": fact, "hint": "Теориядағы негізгі тұжырымды қолданыңыз."}]
        per_chapter[lesson["chapter"]]["writingTasks"][lesson["id"]] = writing
        q_pdf = fixed_source or (source[0] if source else None)
        if q_pdf is None:
            # Generated theory item fallback can be represented in the same print layout.
            q_pdf = {"n": 0, "file": "теория", "q": generated[0]["q"], "kind": "single",
                     "opts": {chr(65+i): value for i, value in enumerate(generated[0]["opts"])},
                     "key": chr(65 + generated[0]["ans"]), "ctx": "",
                     "exp": generated[0]["exp"], "lefts": [], "rights": [], "pairs": [], "ans_all": []}
        q_pdf["exp"] = f"Жауап кілті: {q_pdf.get('key','')}. Сұрақ тараулық тесттен алынды."
        mistake = data["mistakes"][0] if data["mistakes"] else None
        filename = f"{lesson['id']}.pdf"
        make_pdf(pdf_dir / filename, lesson, q_pdf, mistake, data["facts"])
        pdf_url = f"/materials/error-work/{filename}"
        per_chapter[lesson["chapter"]]["lessonErrorWork"][lesson["id"]] = {"pdfUrl": pdf_url}
        pdf_info.append({"lessonId": lesson["id"], "title": lesson["title"], "path": pdf_url,
                         "sourceTest": (q_pdf.get("file"), q_pdf.get("n")), "avgAlignment": data["avgSourceScore"]})

    # Make the SQL payloads idempotent and sized per chapter for safe upload.
    payload_dir = args.out / "by-chapter"
    payload_dir.mkdir(parents=True, exist_ok=True)
    for chapter, patch in per_chapter.items():
        path = payload_dir / f"chapter_{chapter:02d}.json"
        path.write_text(json.dumps(patch, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    pdfs = sorted(pdf_dir.glob("chem_c*_t*.pdf"))
    if len(pdfs) != 224:
        raise SystemExit(f"Expected 224 PDFs, found {len(pdfs)}")
    # Validate every file is readable and includes the lesson title.
    from pypdf import PdfReader
    pdf_check = []
    for info in pdf_info:
        path = pdf_dir / Path(info["path"]).name
        reader = PdfReader(path)
        text = " ".join(page.extract_text() or "" for page in reader.pages)
        if len(reader.pages) != 2 or not info["title"].split(".", 1)[0].strip("§ ") in text:
            raise SystemExit(f"PDF validation failed for {path.name}")
        pdf_check.append(path.stat().st_size)
    report = {
        "lessonCount": len(lessons), "theoryRows": len([x for x in lesson_map.values() if x["theory"].strip()]),
        "chapterTestFiles": len(tests), "chapterQuestions": len(all_questions), "structuralChecks": structural,
        "matchedQuestionsCount": sum(alignment.values()), "lowAlignmentLessons": low_alignment,
        "sourceQuestionUse": len(source_use), "pdfCount": len(pdfs), "pdfBytes": sum(pdf_check),
        "missingSourceFiles": missing_files, "generatedQuestionsPerAssessment": 4,
        "lessonIds": sorted(x["id"] for x in lessons),
    }
    (args.out / "alignment_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    (args.out / "pdf_manifest.json").write_text(json.dumps(pdf_info, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("lessonCount", "theoryRows", "chapterTestFiles", "chapterQuestions", "matchedQuestionsCount", "lowAlignmentLessons", "sourceQuestionUse", "pdfCount", "pdfBytes", "missingSourceFiles")}, ensure_ascii=False))


if __name__ == "__main__":
    main()

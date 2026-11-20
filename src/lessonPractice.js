const CHLORINE_OXYACIDS_NOTE = `### Оқу мақсаттары

- Хлордың оттекті қышқылдары мен қышқыл қалдықтарын ажырату;
- Қышқылдардағы және тұздардағы хлордың тотығу дәрежесін анықтау;
- Гипохлориттер мен хлораттардың қолданылуын және қауіпсіздік ережелерін білу.

### Негізгі ұғым

**Хлордың оттекті қышқылдары** — құрамында сутек, хлор және оттек атомдары бар қышқылдар. Оларға HClO, HClO₂, HClO₃ және HClO₄ жатады.

### Түсіндірме

#### 1. Қышқылдардың формуласы және хлордың тотығу дәрежесі

Оттектің тотығу дәрежесі көбіне −2, ал сутектікі +1 болады. Бейтарап молекуладағы тотығу дәрежелерінің қосындысы нөлге тең.

| Қышқыл | Атауы | Cl тотығу дәрежесі |
|---|---|---:|
| HClO | Гипохлорлы қышқыл | +1 |
| HClO₂ | Хлорлы қышқыл | +3 |
| HClO₃ | Хлор қышқылы | +5 |
| HClO₄ | Перхлор қышқылы | +7 |

**Мысал:** HClO₃ үшін: (+1) + x + 3(−2) = 0, сондықтан x = +5.

Қышқыл құрамындағы оттек атомдарының саны көбейген сайын хлордың тотығу дәрежесі артады. Қышқыл атауларындағы «гипо-» ең аз, «пер-» ең көп оттекке сәйкес келеді.

#### 2. Қышқыл қалдықтары мен тұздары

| Қышқыл | Қышқыл қалдығы | Тұз атауының үлгісі |
|---|---|---|
| HClO | ClO⁻, гипохлорит | NaClO — натрий гипохлориті |
| HClO₂ | ClO₂⁻, хлорит | NaClO₂ — натрий хлориті |
| HClO₃ | ClO₃⁻, хлорат | KClO₃ — калий хлораты |
| HClO₄ | ClO₄⁻, перхлорат | KClO₄ — калий перхлораты |

Қышқыл молекуласындағы бір сутек ионы H⁺ бөлінгенде сәйкес қышқыл қалдығы түзіледі. Мысалы: HClO₃ → H⁺ + ClO₃⁻.

#### 3. Маңызды қасиеттері мен қолданылуы

- **Гипохлориттер** ағартқыш және залалсыздандырғыш заттардың құрамында кездеседі. NaClO — тұрмыстық ағартқыштың белсенді құрамдастарының бірі.
- **Хлораттар** күшті тотықтырғыштар. Қыздырғанда калий хлораты оттек бөле ыдырайды: 2KClO₃ → 2KCl + 3O₂↑ (MnO₂ — катализатор).
- Қышқылдардың күші мен тұрақтылығы ерітінді жағдайына тәуелді; оларды тек формуладағы оттек санымен бірдей деп түсіндіруге болмайды.

### Қауіпсіздік

Гипохлориті бар ағартқышты қышқылдармен немесе аммиакпен араластырмаңыз: улы газдар бөлінуі мүмкін. Хлораттар — тотықтырғыштар; оларды жанғыш заттардан, оттан және ластанудан алыс сақтау керек. Тәжірибелер тек мұғалімнің бақылауымен орындалады.

### Жиі кездесетін қателіктер

| Қате | Дұрысы |
|---|---|
| HClO₃-тегі хлордың тотығу дәрежесін +3 деп алу | HClO₃ құрамында Cl = +5; теңдеу: +1 + x − 6 = 0 |
| ClO⁻ пен ClO₃⁻ иондарын бірдей атау | ClO⁻ — гипохлорит, ClO₃⁻ — хлорат |
| Барлық хлорлы оттекті тұздарды қауіпсіз деп санау | Хлораттар күшті тотықтырғыш; заттаңба мен зертхана қауіпсіздігін сақтау қажет |

### ҰБТ кеңестері

- Cl тотығу дәрежесін табуда H = +1, O = −2 мәндерін қолданыңыз;
- HClO, HClO₂, HClO₃, HClO₄ қатарында Cl тотығу дәрежелері +1, +3, +5, +7;
- Қышқыл қалдығы мен тұз атауын сәйкестендіріңіз: ClO⁻ — гипохлорит, ClO₃⁻ — хлорат;
- Реакция теңдеуінде атомдар мен зарядтың сақталуын тексеріңіз.

### Тапсырмалар

1. HClO₂ және HClO₄ қышқылдарындағы хлордың тотығу дәрежесін есептеңіз.
2. ClO₂⁻ және ClO₄⁻ иондарының атауын жазыңыз.
3. 2KClO₃ → 2KCl + 3O₂ теңдеуіндегі коэффициенттер мен бөлінетін газды атаңыз.
4. Неліктен ағартқышты қышқылмен араластыруға болмайтынын түсіндіріңіз.`;

function repairedDescription(lesson) {
  if (!lesson) return "";
  if (lesson.id === "chem_l119" && !String(lesson.description || "").trim()) return CHLORINE_OXYACIDS_NOTE;
  if (lesson.id !== "chem_l26") return lesson.description || "";
  return String(lesson.description || "")
    .replaceAll("m(¹²C)12", "m(¹²C) / 12")
    .replaceAll("m_a1  а.м.б.", "m_a / (1 а.м.б.)")
    .replaceAll("m_a(1/12) m(¹²C)", "m_a / (m(¹²C) / 12)");
}

const metadataCache = new WeakMap();

function plain(text) {
  return String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\*\*|__|`/g, "")
    .replace(/\\%/g, "%")
    .replace(/\$\$?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function section(text, heading) {
  const lines = String(text || "").split("\n");
  const target = heading.trim().toLocaleLowerCase("kk-KZ");
  const start = lines.findIndex((line) => {
    if (!/^#{2,4}\s+/.test(line)) return false;
    const title = line.replace(/^#{2,4}\s+/, "").trim().toLocaleLowerCase("kk-KZ");
    return title === target || title.startsWith(`${target} `) || title.startsWith(`${target} (`) || title.startsWith(`${target}:`);
  });
  if (start < 0) return "";
  let end = start + 1;
  while (end < lines.length && !/^#{2,4}\s+/.test(lines[end])) end++;
  return lines.slice(start + 1, end).join("\n");
}

function objectives(text) {
  const value = section(text, "Оқу мақсаттары");
  return value.split("\n").map((line) => line.match(/^\s*[-*+]\s+(.+?)\s*$/)?.[1])
    .map(plain).filter((item) => item.length > 12 && item.length < 220);
}

function definition(text) {
  let value = section(text, "Негізгі ұғым");
  if (!value) value = section(text, "Түсіндірме");
  const candidateLine = value.split("\n").map((line) => line.trim())
    .find((line) => line && !/^[-*+>|#\d]/.test(line) && !/^\$+$/.test(line));
  const candidate = plain(candidateLine || "");
  if (candidate.length <= 230) return candidate;
  return `${candidate.slice(0, 220).replace(/\s+\S*$/, "")}…`;
}

function markdownRows(text) {
  const rows = [];
  for (const line of String(text || "").split("\n")) {
    const value = line.trim();
    if (!value.startsWith("|") || !value.endsWith("|") || /^\|[\s:|−–—-]+\|$/.test(value)) continue;
    const cells = value.slice(1, -1).split("|").map(plain);
    if (cells.length >= 2) rows.push(cells);
  }
  return rows;
}

function mistakePairs(text) {
  const content = section(text, "Жиі кездесетін қателіктер");
  return markdownRows(content).slice(1).filter((row) => row[0] && row[1] && row[0] !== "Қате" && row[1] !== "Дұрысы");
}

function tips(text) {
  const content = section(text, "ҰБТ кеңестері");
  return content.split("\n").map((line) => line.match(/^\s*[-*+]\s+(.+?)\s*$/)?.[1])
    .map(plain).filter((item) => item.length > 12 && item.length < 220);
}

function subsections(text) {
  return [...String(text || "").matchAll(/^####\s+(.+)$/gm)].map((match) => plain(match[1]))
    .filter((item) => item.length > 5 && item.length < 140);
}

function formulaLines(text) {
  return String(text || "").split("\n").map((line) => line.trim())
    .filter((line) => line.length >= 8 && line.length <= 150)
    .filter((line) => !/^(?:[-*+>\s]|\d+[.)]\s|#{1,6}\s|\|)/.test(line) && !/^\$+$/.test(line))
    .filter((line) => /(?:→|⇌|≈|≤|≥|\b(?:pH|pOH|M_r|A_r|K_w|V_m|N_A|n|m|V|c|w|D|α)\s*=|[A-Z0-9₀-₉][^\n]{0,24}\s=)/.test(line))
    .filter((line) => !/(?:мысал|шешуі|жауабы|мұндағы|есептеңіз|анықтамасын|тапсырма|сурет|тұжырым)/i.test(line))
    .map(plain)
    .filter((line) => line.length >= 8 && line.length <= 150 && !/[|>]/.test(line));
}

function facts(text) {
  const value = String(text || "").split(/^###\s*(?:Тапсырмалар|Бақылау сұрақтары|Жауап кілті)/mi)[0];
  return [...new Set(value.split("\n")
    .map((line) => line.trim().replace(/^[-*+]\s+/, ""))
    .filter((line) => line.length >= 28 && line.length <= 190)
    .filter((line) => !/^(?:>\s*|#{1,6}\s|\||\$|\d+[.)]\s)/.test(line))
    .filter((line) => !/[?]$/.test(line) && !/(?:есебі|шешуі|жауабы|сурет|деңгейі|дұрыс жауап|визуалды ұсыныс)/i.test(line))
    .map(plain)
    .filter((line) => line.length >= 28 && line.length <= 190))];
}

function prepare(topics) {
  const entries = [];
  for (const [subjectId, chapters] of Object.entries(topics || {})) {
    for (const chapter of chapters || []) {
      for (const lesson of chapter.lessons || []) {
        const match = String(lesson.title || "").match(/§\s*(\d+)/);
        if (!match) continue;
        let text = repairedDescription(lesson);
        // §68 is specifically about metals reacting with oxygen and water.
        // Keep the later non-metal subsection in the lesson notes, but exclude it
        // from generated practice questions so chlorine-water is never keyed as
        // a metal reaction in this lesson.
        if (lesson.id === "chem_l68") {
          text = text.split(/^####\\s+4\\.\\s+Бейметалдардың сумен әрекеттесуі/im)[0];
        }
        entries.push({
          ...lesson, subjectId, chapterTitle: chapter.title, sectionNumber: Number(match[1]),
          description: text, definition: definition(text), objectives: objectives(text),
          mistakes: mistakePairs(text), tips: tips(text), subsections: subsections(text), formulas: formulaLines(text),
        });
      }
    }
  }
  return entries;
}

function stableHash(text) {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function makeQuestion(entry, number, prompt, correct, candidates, explanation) {
  const unique = [...new Set([correct, ...candidates.filter(Boolean)].filter((value) => value && value !== correct))].slice(0, 3);
  if (!correct || unique.length < 2) return null;
  const list = [correct, ...unique];
  const seed = stableHash(`${entry.id}:${number}:${prompt}`);
  for (let i = list.length - 1; i > 0; i--) {
    const j = (seed + i * 2654435761) % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return {
    id: `${entry.id}_auto_fix_${number}`,
    q: prompt,
    opts: list,
    ans: list.indexOf(correct),
    exp: `${explanation} Дереккөз: ${entry.title}.`,
    topic: entry.title,
  };
}

function buildQuestionSet(entry, allEntries) {
  const peers = allEntries.filter((item) => item.subjectId === entry.subjectId && item.id !== entry.id && item.sectionNumber !== entry.sectionNumber);
  const nearest = [...peers].sort((a, b) => (a.chapterTitle === entry.chapterTitle ? 0 : 10000) - (b.chapterTitle === entry.chapterTitle ? 0 : 10000) || Math.abs(a.sectionNumber - entry.sectionNumber) - Math.abs(b.sectionNumber - entry.sectionNumber));
  const qs = [];
  const makeCandidates = (field, ownList, limit = 9) => {
    const values = nearest.flatMap((peer) => peer[field] || []).filter((value) => !ownList.includes(value));
    return [...new Set(values)].slice(0, limit);
  };
  const conceptDistractors = nearest.map((item) => item.definition).filter(Boolean);
  const q1 = makeQuestion(entry, 1, `«${entry.title}» сабағындағы негізгі ұғымның дұрыс анықтамасын таңдаңыз.`, entry.definition, conceptDistractors, "Анықтама конспектідегі негізгі ұғым бөлімінен алынды.");
  if (q1) qs.push(q1);

  if (entry.objectives.length) {
    const correct = entry.objectives[stableHash(entry.id) % entry.objectives.length];
    const q = makeQuestion(entry, 2, `«${entry.title}» сабағынан кейін оқушы меңгеруі тиіс оқу мақсатын таңдаңыз.`, correct, makeCandidates("objectives", entry.objectives), "Оқу мақсаты сабақ конспектісінен алынған.");
    if (q) qs.push(q);
  }

  if (entry.mistakes.length) {
    const pair = entry.mistakes[stableHash(`${entry.id}:mistake`) % entry.mistakes.length];
    const q = makeQuestion(entry, 3, `Қате тұжырымға дұрыс түзетуді таңдаңыз: «${pair[0]}»`, pair[1], nearest.flatMap((item) => item.mistakes.map((row) => row[1])), "Дұрыс түзету конспектідегі «Жиі кездесетін қателіктер» кестесінен алынды.");
    if (q) qs.push(q);
  }

  if (entry.tips.length) {
    const correct = entry.tips[stableHash(`${entry.id}:tip`) % entry.tips.length];
    const q = makeQuestion(entry, 4, `«${entry.title}» тақырыбына қатысты ҰБТ кеңесін таңдаңыз.`, correct, makeCandidates("tips", entry.tips), "Кеңес сабақ конспектісіндегі ҰБТ кеңестері бөлімінен алынды.");
    if (q) qs.push(q);
  }

  if (entry.formulas.length) {
    const correct = entry.formulas[stableHash(`${entry.id}:formula`) % entry.formulas.length];
    const q = makeQuestion(entry, 5, `Төмендегі жазбалардың қайсысы «${entry.title}» конспектісінде берілген?`, correct, makeCandidates("formulas", entry.formulas), "Формула/теңдеу сабақ конспектісінен сол күйі алынды.");
    if (q) qs.push(q);
  }

  if (qs.length < 3 && entry.subsections.length) {
    const correct = entry.subsections[stableHash(`${entry.id}:heading`) % entry.subsections.length];
    const q = makeQuestion(entry, 6, `«${entry.title}» сабағында қарастырылатын бөлімді таңдаңыз.`, correct, nearest.flatMap((item) => item.subsections), "Бөлім атауы осы сабақтың конспектісінен алынды.");
    if (q) qs.push(q);
  }

  const ownFacts = facts(entry.description);
  const otherFacts = nearest.flatMap((item) => facts(item.description));
  let factIndex = 0;
  while (qs.length < 5 && factIndex < ownFacts.length) {
    const correct = ownFacts[(stableHash(`${entry.id}:fact:${factIndex}`) + factIndex) % ownFacts.length];
    const q = makeQuestion(entry, 10 + factIndex, `Қай тұжырым «${entry.title}» конспектісінде берілген?`, correct, otherFacts, "Тұжырым сабақтың теориялық мәтінінен алынған.");
    if (q && !qs.some((existing) => existing.opts[existing.ans] === correct)) qs.push(q);
    factIndex++;
  }

  const ownClaims = [...new Set([...ownFacts, ...entry.objectives, ...entry.tips, ...entry.subsections, ...entry.mistakes.map((row) => row[1])])];
  const outsideClaims = [...new Set(allEntries.filter((item) => item.subjectId === entry.subjectId && item.id !== entry.id && item.chapterTitle !== entry.chapterTitle).flatMap((item) => [...facts(item.description), ...item.objectives, ...item.tips]))];
  let claimIndex = 0;
  while (qs.length < 5 && claimIndex < ownClaims.length + outsideClaims.length) {
    const useOwn = claimIndex % 2 === 0 || !outsideClaims.length;
    const claimPool = useOwn ? ownClaims : outsideClaims;
    if (!claimPool.length) { claimIndex++; continue; }
    const claim = claimPool[(stableHash(`${entry.id}:claim:${claimIndex}`) + claimIndex) % claimPool.length];
    const isCourseFact = ownClaims.includes(claim);
    const prompt = `«${entry.title}» сабағына сәйкестігін анықтаңыз: «${claim}»`;
    if (!qs.some((existing) => existing.q === prompt)) {
      qs.push({
        id: `${entry.id}_auto_fix_${20 + claimIndex}`,
        q: prompt,
        opts: ["Осы сабақтың конспектісіне сәйкес", "Бұл басқа тақырыпқа қатысты"],
        ans: isCourseFact ? 0 : 1,
        exp: isCourseFact ? `Тұжырым сабақ конспектісінен алынған. Дереккөз: ${entry.title}.` : "Бұл тұжырым басқа сабақтың материалынан алынды; осы сабақтың жазбасында кездеспейді.",
        topic: entry.title,
      });
    }
    claimIndex++;
  }
  if (!qs.length && entry.title) {
    const q = makeQuestion(entry, 7, `Қай тақырып «${entry.chapterTitle}» тарауына жатады?`, entry.title, nearest.map((item) => item.title), "Сабақ атауы тарау мазмұнынан алынды.");
    if (q) qs.push(q);
  }
  return qs;
}

export function getLessonDescription(lesson) {
  return repairedDescription(lesson);
}

export function getGeneratedFixQuestions(lessonId, topics) {
  if (!topics || typeof topics !== "object") return [];
  let byId = metadataCache.get(topics);
  if (!byId) {
    const entries = prepare(topics);
    byId = new Map(entries.map((entry) => [entry.id, buildQuestionSet(entry, entries)]));
    metadataCache.set(topics, byId);
  }
  return byId.get(lessonId) || [];
}
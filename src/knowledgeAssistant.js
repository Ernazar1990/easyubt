const STOP_WORDS = new Set([
  "және", "үшін", "туралы", "деген", "дегеніміз", "не", "қалай", "қандай", "мен", "бұл", "сол", "осы",
  "түсіндір", "түсіндірші", "айтып", "бер", "please", "what", "is", "the", "of", "how"
]);

function words(value) {
  return String(value || "")
    .toLocaleLowerCase("kk-KZ")
    .replace(/[әғқңөұүһі]/g, (letter) => ({ ә:"a", ғ:"g", қ:"k", ң:"n", ө:"o", ұ:"u", ү:"u", һ:"h", і:"i" })[letter])
    .match(/[a-z0-9]+/g)
    ?.filter((word) => word.length > 1 && !STOP_WORDS.has(word)) || [];
}

function collectKnowledge({ topics = {}, content = {} } = {}) {
  const entries = [];
  for (const [subjectId, chapters] of Object.entries(topics || {})) {
    for (const chapter of chapters || []) {
      for (const lesson of chapter.lessons || []) {
        const body = String(lesson.description || "").trim();
        if (body.length > 60) {
          entries.push({
            kind: "lesson",
            title: lesson.title || chapter.title || "Сабақ материалы",
            chapter: chapter.title,
            subjectId,
            body,
          });
        }
      }
    }
  }

  const addQuestions = (groups, subjectId) => {
    for (const [groupId, questions] of Object.entries(groups || {})) {
      for (const question of Array.isArray(questions) ? questions : []) {
        if (!question?.q) continue;
        entries.push({
          kind: "question",
          title: question.q,
          chapter: question.topic || groupId,
          subjectId,
          body: [question.q, ...(question.opts || []), question.exp || ""].join(" "),
          question,
        });
      }
    }
  };

  addQuestions(content.lessonTests, "Химия");
  addQuestions(content.hwTests, "Химия");
  addQuestions(content.questions, "Химия");
  for (const [subjectId, variants] of Object.entries(content.variants || {})) {
    for (const variant of variants || []) {
      addQuestions({ [variant.title || variant.id]: variant.questions || [] }, subjectId);
    }
  }
  return entries;
}

function relevance(queryWords, entry) {
  const titleWords = words(entry.title);
  const bodyWords = words(entry.body);
  let score = 0;
  for (const queryWord of queryWords) {
    const titleMatch = titleWords.some((word) => word === queryWord || (queryWord.length >= 4 && word.startsWith(queryWord.slice(0, 4))));
    const bodyMatch = bodyWords.some((word) => word === queryWord || (queryWord.length >= 4 && word.startsWith(queryWord.slice(0, 4))));
    if (titleMatch) score += 3;
    else if (bodyMatch) score += 1;
  }
  return score;
}

const knowledgeCache = new WeakMap();

function getKnowledge(source) {
  const content = source?.content || {};
  const topics = source?.topics || {};
  if (content && typeof content === "object") {
    let byTopics = knowledgeCache.get(content);
    if (!byTopics) {
      byTopics = new WeakMap();
      knowledgeCache.set(content, byTopics);
    }
    if (topics && typeof topics === "object") {
      let entries = byTopics.get(topics);
      if (!entries) {
        entries = collectKnowledge({ topics, content });
        byTopics.set(topics, entries);
      }
      return entries;
    }
  }
  return collectKnowledge({ topics, content });
}

export function answerFromKnowledgeBase(query, source) {
  const queryWords = [...new Set(words(query))];
  if (!queryWords.length) return "Сұрағыңызды нақтырақ жазыңыз. Мысалы: «Атомның құрылысы» немесе «Моль санын қалай есептейді?»";

  const matches = getKnowledge(source)
    .map((entry) => ({ entry, score: relevance(queryWords, entry) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = matches[0];
  const minScore = queryWords.length === 1 ? 3 : 2;
  if (!best || best.score < minScore) {
    return "Бұл сұраққа жауап беретін материал оқу базасынан табылмады. Қазір көмекші тек платформадағы сабақтар мен тест деректерін қолданады, сондықтан болжап жауап бермейді. Сабақтар бөлімінен тақырыпты ашып, сұрағыңызды сол тақырыптағы терминдермен қайталап көріңіз.";
  }

  const { entry } = best;
  if (entry.kind === "question" && best.score >= Math.max(4, queryWords.length * 1.5)) {
    const { question } = entry;
    const options = question.opts || [];
    const correct = Number.isInteger(question.ans) ? options[question.ans] : null;
    if (correct) {
      const explanation = question.exp ? `\n\nТүсіндірме: ${question.exp}` : "";
      return `Базадағы ұқсас сұрақ: «${question.q}»\nЖауабы: ${correct}${explanation}\n\nДереккөз: ${entry.chapter}.`;
    }
  }

  const cleanBody = entry.body
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const excerpt = cleanBody.length > 1200 ? `${cleanBody.slice(0, 1200).trim()}…` : cleanBody;
  return `${excerpt}\n\nДереккөз: ${entry.title}${entry.chapter ? ` · ${entry.chapter}` : ""}.`;
}


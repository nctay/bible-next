export interface Verse { number: number; text: string }
export interface Source { title: string; location?: string; url: string; author?: string; attribution?: string }
export interface Scripture {
  id: string; reference: string; translation: string; sources: Source[];
  chapters: { number: number; verses: Verse[] }[];
}
export interface Note {
  id: string; verses: string[]; anchor?: { verse: string; phrase: string };
  reference: string; title: string; kind: 'Редакционный разбор' | 'Смысл стиха' | 'Контекст эпизода'; summary: string;
  sections: { title: string; paragraphs: string[] }[];
  sources: Source[];
}

// shortcut: inline source links only; use a Markdown parser if editorial formatting expands.
export function inlineSources(text: string) {
  const parts: { text: string; url?: string }[] = [];
  let position = 0;
  for (const match of text.matchAll(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g)) {
    parts.push({ text: text.slice(position, match.index) }, { text: match[1], url: match[2] });
    position = match.index + match[0].length;
  }
  parts.push({ text: text.slice(position) });
  return parts;
}
const chapterLengths = [
  31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33, 38, 18, 34, 24, 20, 67, 34,
  35, 46, 22, 35, 43, 55, 32, 20, 31, 29, 43, 36, 30, 23, 23, 57, 38, 34, 34, 28, 34, 31, 22, 33, 26,
];

export function validateContent(scripture: Scripture, notes: Note[]) {
  if (!Array.isArray(scripture?.chapters) || !Array.isArray(notes)) throw new Error('Некорректный выпуск');
  if (scripture.chapters.length !== chapterLengths.length || scripture.chapters.some((c, i) =>
    c.number !== i + 1 || c.verses.length !== chapterLengths[i] ||
    c.verses.some((v, j) => v.number !== j + 1 || typeof v.text !== 'string' || !v.text.trim()))) {
    throw new Error('Неполный текст выпуска');
  }
  const verses = new Map<string, string>(scripture.chapters.flatMap(c => c.verses.map(v => [`${c.number}:${v.number}`, v.text] as const)));
  if (new Set(notes.map(n => n.id)).size !== notes.length) throw new Error('Повтор пояснения');
  const meaning = new Set<string>();
  for (const note of notes) {
    if (!note.id || !note.reference || !note.title || !note.summary ||
        !['Редакционный разбор', 'Смысл стиха', 'Контекст эпизода'].includes(note.kind) ||
        !note.verses?.length || note.verses.some(key => !verses.has(key)) ||
        !note.sources?.length || (note.anchor && (!note.anchor.phrase || !note.verses.includes(note.anchor.verse) ||
        !verses.get(note.anchor.verse)?.includes(note.anchor.phrase)))) {
      throw new Error(`Некорректное пояснение: ${note.id}`);
    }
    if (note.sections.some(s => !s.title || !s.paragraphs?.length || s.paragraphs.some(p => !p))) {
      throw new Error(`Некорректный раздел: ${note.id}`);
    }
    for (const paragraph of [note.summary, ...note.sections.flatMap(s => s.paragraphs)]) {
      if (inlineSources(paragraph).some(part => part.url && !note.sources.some(s => s.url === part.url))) {
        throw new Error(`Не найдена атрибуция источника: ${note.id}`);
      }
    }
    if (note.kind !== 'Редакционный разбор') for (const key of note.verses) meaning.add(key);
  }
  const uncovered = [...verses.keys()].filter(key => !meaning.has(key));
  if (uncovered.length) throw new Error(`Стихи без смыслового пояснения: ${uncovered.join(', ')}`);
  const sources = [...scripture.sources, ...notes.flatMap(n => n.sources)];
  if (sources.some(s => !s.title || new URL(s.url).protocol !== 'https:')) throw new Error('Некорректный источник');
}
export function noteReference(note: Note) {
  return note.reference;
}

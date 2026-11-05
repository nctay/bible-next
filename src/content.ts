export interface Verse { number: number; text: string }
export interface Source { title: string; location?: string; url: string; author?: string; attribution?: string }
export interface Scripture {
  id: string; reference: string; translation: string; sources: Source[];
  chapters: { number: number; verses: Verse[] }[];
}
export interface Note {
  id: string; chapter: number; verses: number[]; phrase: string; anchorVerse: number;
  reference: string; title: string; kind: string; status: 'draft'; summary: string;
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
export function validateContent(scripture: Scripture, notes: Note[]) {
  if (!Array.isArray(scripture?.chapters) || !Array.isArray(notes)) throw new Error('Некорректный выпуск');
  const verses = scripture.chapters.flatMap(c => c.verses.map(v => ({ ...v, chapter: c.number })));
  if (verses.length !== 34 || verses.some(v => !v.text || !Number.isInteger(v.number)) ||
      scripture.chapters.length !== 2 || scripture.chapters.some((c, i) => c.number !== i + 1 ||
      c.verses.length !== (i === 0 ? 31 : 3) || c.verses.some((v, j) => v.number !== j + 1))) {
    throw new Error('Неполный текст выпуска');
  }
  if (new Set(notes.map(n => n.id)).size !== notes.length) throw new Error('Повтор пояснения');
  for (const note of notes) {
    const anchor = verses.find(v => v.chapter === note.chapter && v.number === note.anchorVerse);
    if (!note.id || !note.reference || !note.title || !note.summary || note.kind !== 'Редакционный разбор' || note.status !== 'draft' ||
        !note.sections?.length || note.sections.some(s => !s.title || !s.paragraphs?.length || s.paragraphs.some(p => !p)) || !note.sources?.length ||
        !note.phrase || !anchor?.text.includes(note.phrase) || !note.verses.includes(note.anchorVerse) ||
        note.verses.some(n => !verses.some(v => v.chapter === note.chapter && v.number === n))) {
      throw new Error('Не найдена привязка пояснения');
    }
    for (const section of note.sections) for (const paragraph of section.paragraphs) {
      if (inlineSources(paragraph).some(part => part.url && !note.sources.some(s => s.url === part.url))) {
        throw new Error('Не найдена атрибуция источника');
      }
    }
  }
  const sources = [...scripture.sources, ...notes.flatMap(n => n.sources)];
  if (sources.some(s => !s.title || new URL(s.url).protocol !== 'https:')) throw new Error('Некорректный источник');
}
export function noteReference(note: Note) {
  return note.reference;
}

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { inlineSources, validateContent } from '../src/content.ts';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');

export function verseKeys(reference, scripture) {
  const label = reference.split(/ и (?=\d+ [А-ЯЁ])/u)[0].match(/Быт (\d+(?::\d+)?(?:–\d+(?::\d+)?)?(?:(?:[,;] *| и )\d+(?::\d+)?(?:–\d+(?::\d+)?)?)*)/)?.[1];
  if (!label) throw new Error(`Некорректная ссылка: ${reference}`);
  const keys = new Set();
  let chapter;
  for (const part of label.split(/\s*(?:[,;]| и )\s*/)) {
    const match = part.match(/^(?:(\d+):)?(\d+)(?:–(?:(\d+):)?(\d+))?$/);
    if (!match) throw new Error(`Некорректная ссылка: ${reference}`);
    const [, startChapter, start, endChapter, end] = match;
    if (startChapter) chapter = Number(startChapter);
    const firstChapter = chapter ?? Number(start);
    const lastChapter = endChapter ? Number(endChapter) : chapter ?? Number(end ?? start);
    for (let current = firstChapter; current <= lastChapter; current++) {
      const length = scripture.chapters[current - 1]?.verses.length;
      const from = chapter && current === firstChapter ? Number(start) : 1;
      const to = chapter && current === lastChapter ? Number(end ?? start) : length;
      if (!length || from < 1 || to > length || from > to) throw new Error(`Вне книги: ${reference}`);
      for (let verse = from; verse <= to; verse++) keys.add(`${current}:${verse}`);
    }
    if (endChapter) chapter = lastChapter;
    if (firstChapter > lastChapter) throw new Error(`Обратный диапазон: ${reference}`);
  }
  return [...keys];
}

export async function readContent() {
  const scripture = JSON.parse(await read('public/content/genesis.json'));
  const metadata = JSON.parse(await read('docs/content/genesis-1-reader-metadata.json'));
  const files = (await readdir(new URL('docs/content/', root)))
    .filter(file => /^genesis-\d+[\da-z-]*-(review|verse-meaning)\.md$/.test(file))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const notes = [];

  function add(id, kind, reference, title, summary, sections, fallback = []) {
    const verses = verseKeys(reference, scripture);
    const anchor = id.startsWith('genesis-1-review-') ? metadata.anchors[title] : undefined;
    const sources = new Map();
    for (const paragraph of [summary, ...sections.flatMap(section => section.paragraphs)]) {
      for (const { url, text } of inlineSources(paragraph)) {
        if (url && !sources.has(url)) sources.set(url, { title: text, url, ...metadata.sources[url] });
      }
    }
    for (const source of fallback) if (!sources.has(source.url)) sources.set(source.url, source);
    notes.push({ id: anchor?.id ?? id, kind, reference, title, summary, sections, verses,
      sources: [...sources.values()], ...(anchor && { anchor }) });
  }

  for (const file of files) {
    const text = await read(`docs/content/${file}`);
    const thematic = file.endsWith('-review.md');
    const heading = thematic ? /^(\d+)\. (.+?) — (.+)$/ : /^(С\d+) — (Быт [\d:–]+)(?: — (.+))?$/;
    let count = 0;
    for (const [, header, body] of text.matchAll(/^## ([^\n]+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)) {
      const match = header.match(heading);
      const prefix = file.slice(0, -3);
      if (match) {
        const [, number, reference, title = `Смысл · ${reference}`] = match;
        if (Number(number.replace(/^С/, '')) !== ++count) throw new Error(`Пропуск номера: ${file}, ${header}`);
        const [lead, ...paragraphs] = body.trim().split(/\n\s*\n/);
        const summary = lead.match(/^\*\*(?:Коротко|Смысл|Что значит стих|Что значат связанные стихи)\.\*\*\s+([\s\S]+)$/)?.[1];
        if (!summary) throw new Error(`Нет краткого пояснения: ${file}, ${header}`);
        const sections = [];
        for (const paragraph of paragraphs) {
          const label = paragraph.match(/^\*\*([^\n]+?)\.\*\*\s+([\s\S]+)$/);
          if (label || !sections.length) sections.push({ title: label?.[1] ?? 'Основания', paragraphs: [label?.[2] ?? paragraph] });
          else sections.at(-1).paragraphs.push(paragraph);
        }
        add(`${prefix}-${number}`, thematic ? 'Редакционный разбор' : 'Смысл стиха', reference, title, summary, sections);
      } else if (/^\d+\.|^С\d+/.test(header)) {
        throw new Error(`Не распознан заголовок: ${file}, ${header}`);
      } else if (!thematic && /^(?:Эпизоды|\S+ эпизодов?|Краткий контекст частей рассказа)$/.test(header)) {
        const episodes = [
          ...body.matchAll(/^\| ([\d:–]+) \| (.+?) \|$/gm),
          ...body.matchAll(/^- \*\*[ЭФ]\d+, ([\d:–]+)\.\*\* (.+)$/gm),
        ];
        for (const [, range, summary] of episodes) {
          const reference = `Быт ${range}`;
          const source = { title: `Синодальный текст · ${reference}`, url: `https://ebible.org/russyn/GEN${range.split(':')[0].padStart(2, '0')}.htm` };
          add(`${prefix}-episode-${range}`, 'Контекст эпизода', reference, `Эпизод · ${reference}`, summary, [], [source]);
        }
      }
    }
    if (!count) throw new Error(`Файл без карточек: ${file}`);
  }

  for (const anchor of Object.values(metadata.anchors)) {
    if (!notes.some(note => note.id === anchor.id)) throw new Error(`Не найдено пояснение для фразы: ${anchor.phrase}`);
  }
  validateContent(scripture, notes);
  return { scripture, notes };
}

if (process.argv[1] && new URL(process.argv[1], 'file:').href === import.meta.url) {
  const { notes } = await readContent();
  await writeFile(new URL('public/content/notes.json', root), JSON.stringify(notes));
  console.log(`Пояснений в выпуске: ${notes.length}`);
}

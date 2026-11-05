import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContent, noteReference, inlineSources } from '../src/content.ts';
const scripture = JSON.parse(await readFile(new URL('../public/content/genesis.json', import.meta.url)));
const notes = JSON.parse(await readFile(new URL('../public/content/notes.json', import.meta.url)));
const dossier = await readFile(new URL('../docs/content/genesis-1-review.md', import.meta.url), 'utf8');
test('every dossier question is exported verbatim with its title, summary, sections and citations', () => {
  const blocks = [...dossier.matchAll(/^## (\d+)\. (.+?) — (.+?)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
  assert.equal(blocks.length, 24);
  assert.equal(notes.length, blocks.length, 'Все вопросы досье должны попасть в выпуск');
  for (const [index, note] of notes.entries()) {
    const paragraphs = blocks[index][4].trim().split(/\n\s*\n/);
    assert.equal(note.title, blocks[index][3]);
    assert.equal(note.reference, blocks[index][2]);
    assert.equal(note.summary, paragraphs[0].replace(/^\*\*Коротко\.\*\*\s*/, ''));
    assert.deepEqual(note.sections.flatMap(section => section.paragraphs), paragraphs.slice(1).map(p => p.replace(/^\*\*.+?\.\*\*\s*/, '')));
    const urls = [...blocks[index][4].matchAll(/\[[^\]]+\]\((https:\/\/[^)]+)\)/g)].map(match => match[1]);
    assert.deepEqual(note.sources.map(source => source.url), [...new Set(urls)]);
  }
});
test('published pilot keeps its complete text, note anchors and attributed sources', () => {
  assert.doesNotThrow(() => validateContent(scripture, notes));
  assert.equal(notes.length, 24);
  for (const note of notes) {
    assert.ok(note.sources.every(s => s.author && s.attribution));
  }
  assert.equal(noteReference(notes[3]), 'Быт 1:3–5 и 14–19');
  assert.equal(notes.filter(n => n.chapter === 1 && n.anchorVerse === 26).length, 3);
  assert.equal(notes.filter(n => n.chapter === 2).length, 2);
});
test('incomplete releases, missing phrases, duplicate notes and missing source attribution are rejected', () => {
  const truncated = structuredClone(scripture); truncated.chapters[1].verses.pop();
  assert.throws(() => validateContent(truncated, notes));
  const broken = structuredClone(notes); broken[0].phrase = 'Фразы нет в Писании';
  assert.throws(() => validateContent(scripture, broken));
  assert.throws(() => validateContent(scripture, [...notes, notes[0]]));
  const insecure = structuredClone(notes); insecure[0].sources[0].url = 'javascript:alert(1)';
  assert.throws(() => validateContent(scripture, insecure));
  const missing = structuredClone(notes); missing[0].sources.pop();
  assert.throws(() => validateContent(scripture, missing));
});
test('inline citations keep surrounding text and multiple authors without rendering arbitrary markup', () => {
  assert.deepEqual(inlineSources('До [Василий](https://example.com/a), [Августин](https://example.com/b).'), [
    { text: 'До ' }, { text: 'Василий', url: 'https://example.com/a' }, { text: ', ' },
    { text: 'Августин', url: 'https://example.com/b' }, { text: '.' },
  ]);
  assert.deepEqual(inlineSources('<script>bad()</script> [bad](javascript:alert)'), [{ text: '<script>bad()</script> [bad](javascript:alert)' }]);
});

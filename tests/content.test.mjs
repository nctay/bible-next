import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readContent, verseKeys } from '../scripts/content.mjs';
import { validateContent, inlineSources } from '../src/content.ts';

const { scripture, notes } = await readContent();

test('the full audited corpus builds with verse coverage and the original phrase anchors', () => {
  assert.equal(scripture.chapters.length, 50);
  assert.equal(scripture.chapters.flatMap(chapter => chapter.verses).length, 1533);
  assert.ok(notes.filter(note => note.kind === 'Редакционный разбор').length >= 1410);
  assert.ok(notes.filter(note => note.kind === 'Смысл стиха').length >= 765);
  assert.equal(notes.filter(note => note.anchor).length, 24);
  assert.equal(notes.filter(note => note.anchor?.verse === '1:26').length, 3);
  assert.ok(notes.find(note => note.id === 'beginning').sources.every(source => source.author && source.attribution));
  assert.doesNotThrow(() => validateContent(scripture, notes));
});

test('references preserve cross-chapter, disjoint and whole-chapter spans', () => {
  assert.deepEqual(verseKeys('Быт 11:31–12:1', scripture), ['11:31', '11:32', '12:1']);
  assert.deepEqual(verseKeys('Быт 6:3 и 5:32', scripture), ['6:3', '5:32']);
  assert.deepEqual(verseKeys('Быт 10:5, 20, 31; 11:1', scripture), ['10:5', '10:20', '10:31', '11:1']);
  assert.deepEqual(verseKeys('Быт 7 и 1 Петр 3:20–21', scripture), verseKeys('Быт 7', scripture));
  assert.equal(verseKeys('Быт 31:55', scripture)[0], '31:55');
  assert.throws(() => verseKeys('Быт 50:27', scripture));
  assert.throws(() => verseKeys('Быт 2:3–1', scripture));
});

test('incomplete releases, missing phrases, duplicate notes and missing citations are rejected', () => {
  const truncated = structuredClone(scripture); truncated.chapters[1].verses.pop();
  assert.throws(() => validateContent(truncated, notes), /Неполный текст/);
  const broken = structuredClone(notes); broken[0].anchor.phrase = 'Фразы нет в Писании';
  assert.throws(() => validateContent(scripture, broken), /Некорректное пояснение/);
  assert.throws(() => validateContent(scripture, [...notes, notes[0]]), /Повтор пояснения/);
  const missing = structuredClone(notes); missing[0].sources.pop();
  assert.throws(() => validateContent(scripture, missing), /атрибуция/);
  assert.throws(() => validateContent(scripture, notes.filter(note => !note.verses.includes('50:26'))), /50:26/);
});

test('inline citations preserve surrounding text and distinct authors', () => {
  assert.deepEqual(inlineSources('До [Василий](https://example.com/a), [Августин](https://example.com/b).'), [
    { text: 'До ' }, { text: 'Василий', url: 'https://example.com/a' }, { text: ', ' },
    { text: 'Августин', url: 'https://example.com/b' }, { text: '.' },
  ]);
});

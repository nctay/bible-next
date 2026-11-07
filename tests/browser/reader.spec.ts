import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const notes: { verses: string[] }[] = JSON.parse(readFileSync('public/content/notes.json', 'utf8'));
const chapterNoteCount = (chapter: number) => notes.filter(note => note.verses.some(verse => verse.startsWith(`${chapter}:`))).length;
const verseNoteCount = (chapter: number, verse: number) => notes.filter(note => note.verses.includes(`${chapter}:${verse}`)).length;
const scripture = JSON.parse(readFileSync('public/content/genesis.json', 'utf8'));

async function openReader(page) {
  await page.goto('/');
  await expect(page.locator('.verse')).toHaveCount(1533);
}

test('phrase and verse annotations preserve reading place and keyboard focus', async ({ page }) => {
  await openReader(page);
  await expect(page.locator('#verse-1-2 .phrase')).toHaveCount(3);
  await expect(page.locator('#verse-1-26 .phrase')).toHaveCount(3);
  await expect(page.getByRole('button', { name: `Пояснения к главе 1: ${chapterNoteCount(1)}` })).toBeVisible();
  const phrase = page.getByRole('button', { name: 'Дух Божий — открыть пояснение' });
  await phrase.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await phrase.focus(); await phrase.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Дух, дыхание или ветер', exact: true })).toBeVisible();
  await dialog.getByText('Авторы и аргументы', { exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'USCCB, примечание к 1:2' })).toHaveAttribute('href', /bible.usccb.org/);
  await dialog.getByText('Сопоставление', { exact: true }).click();
  await expect(dialog.getByText(/Филологический вопрос/)).toBeVisible();
  await page.getByRole('button', { name: 'Развернуть панель' }).click();
  await expect(page.getByRole('button', { name: 'Свернуть панель' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(phrase).toBeFocused();
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(3);
  await page.getByRole('button', { name: `Бытие 1:2 — пояснений: ${verseNoteCount(1, 2)}`, exact: true }).click();
  await expect(page.locator('.note-row')).toHaveCount(verseNoteCount(1, 2));
  await page.getByRole('button', { name: /Что значит неустроенная земля/ }).click();
  await expect(page.getByRole('heading', { name: 'Что значит неустроенная земля' })).toBeVisible();
});

test('all chapter explanations are available and shared phrase anchors do not duplicate Scripture', async ({ page }) => {
  await openReader(page);
  await expect(page.locator('.verse p')).toHaveText(scripture.chapters.flatMap(c => c.verses.map(v => v.text)));
  await page.getByRole('button', { name: `Пояснения к главе 1: ${chapterNoteCount(1)}`, exact: true }).click();
  await expect(page.locator('.note-row')).toHaveCount(chapterNoteCount(1));
  await page.getByRole('button', { name: /Почему Elohim/ }).click();
  await expect(page.getByRole('heading', { name: 'Почему Elohim имеет форму множественного числа' })).toBeVisible();
  await page.getByText('Источники', { exact: true }).click();
  await expect(page.getByRole('link', { name: /A Handbook on Genesis/ })).toHaveAttribute('href', 'https://tips.translation.bible/story/translation-commentary-on-genesis-11/');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'день один — открыть пояснения: 2', exact: true }).click();
  await expect(page.locator('.note-row')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /Что такое день творения/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Почему день один, а не первый/ })).toBeVisible();
});

test('chapter navigation, new annotations and type size remain usable on narrow and landscape phones', async ({ page }) => {
  await openReader(page);
  await page.getByRole('button', { name: 'Открыть содержание', exact: true }).click();
  await page.getByRole('button', { name: /^Глава 2 Стихи/ }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('navigation').getByText('Бытие 2')).toBeVisible();
  await page.getByRole('button', { name: `Бытие 2:1 — пояснений: ${verseNoteCount(2, 1)}`, exact: true }).click();
  await expect(page.getByRole('button', { name: /Почему Бог почил/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.evaluate(() => window.scrollBy(0, -24));
  await page.getByRole('button', { name: 'Настройки чтения' }).click();
  for (let n = 0; n < 9; n++) await page.getByRole('button', { name: 'Увеличить текст' }).click();
  await expect(page.locator('output')).toHaveText('30 px');
  await page.keyboard.press('Escape');
  for (const viewport of [{ width: 320, height: 640 }, { width: 375, height: 812 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.getByRole('button', { name: 'Настройки чтения' }).click();
    await expect(page.getByRole('button', { name: 'Закрыть панель' })).toBeInViewport();
    await page.keyboard.press('Escape');
  }
});

test('reading controls clear the text and return on a short reverse scroll or keyboard focus', async ({ page }) => {
  await openReader(page);
  const dock = page.getByRole('navigation', { name: 'Управление чтением' });
  await expect(page.locator('.topbar')).toHaveCSS('height', '69px');
  await expect(dock).toBeInViewport();

  await page.evaluate(() => window.scrollTo(0, 600));
  await expect(dock).not.toBeInViewport();
  await expect(dock).toHaveCSS('opacity', '0');
  await page.evaluate(() => window.scrollBy(0, -6));
  await expect(dock).not.toBeInViewport();
  await page.evaluate(() => window.scrollBy(0, -8));
  await expect(dock).toBeInViewport();
  await expect(dock).toHaveCSS('opacity', '1');

  await page.evaluate(() => window.scrollBy(0, 100));
  await expect(dock).not.toBeInViewport();
  await page.getByRole('button', { name: 'Вернуться к пояснениям' }).evaluate(button => button.focus({ preventScroll: true }));
  await page.keyboard.press('Tab');
  await expect(dock.locator('.chapter-control')).toBeFocused();
  await expect(dock).toBeInViewport();

  await dock.locator('.chapter-control').evaluate(button => button.blur());
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(dock).toHaveCSS('opacity', '0');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(dock).toHaveCSS('opacity', '1');
});

test('saved release survives offline reload including explanations, attribution, fonts and source links', async ({ page, context }) => {
  await openReader(page);
  await page.getByRole('button', { name: 'Сохранить выпуск без интернета', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить выпуск', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Выпуск на устройстве', exact: true })).toBeVisible({ timeout: 15000 });
  await page.keyboard.press('Escape');
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.verse')).toHaveCount(1533);
  await page.getByRole('button', { name: 'В начале — открыть пояснение' }).click();
  await expect(page.getByRole('heading', { name: 'Что означает начало', exact: true })).toBeVisible();
  await page.getByText('Источники', { exact: true }).click();
  await expect(page.getByText('Василий Великий', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Василий/ })).toHaveAttribute('href', 'https://www.newadvent.org/fathers/32011.htm');
  await expect(page.getByRole('link', { name: /^Августин/ })).toHaveAttribute('href', 'https://www.newadvent.org/fathers/120111.htm');
  expect(await page.evaluate(() => document.fonts.check('21px Lora', 'Бытие'))).toBeTruthy();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Открыть содержание' }).click();
  await page.getByRole('button', { name: /^Глава 50/ }).click();
  await expect(page.getByRole('navigation').getByText('Бытие 50')).toBeVisible();
  await page.getByRole('button', { name: /^Бытие 50:26 —/ }).click();
  await page.getByRole('button', { name: /Последняя сцена в Египте/ }).click();
  await expect(page.getByRole('heading', { name: 'Последняя сцена в Египте' })).toBeVisible();
});

test('failed download never claims success and online reading still works', async ({ page, context }) => {
  await context.route('**/icon-512.png', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await openReader(page);
  await page.getByRole('button', { name: 'Сохранить выпуск без интернета', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить выпуск', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('сохранение', { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Выпуск на устройстве' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.verse')).toHaveCount(1533);
  await context.unroute('**/icon-512.png');
  await page.getByRole('button', { name: 'Сохранить выпуск без интернета', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить выпуск', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Выпуск на устройстве' })).toBeVisible();
});

test('reading works without service worker and when reduced motion is enabled', async ({ page }) => {
  await page.addInitScript(() => { delete (Navigator.prototype as { serviceWorker?: unknown }).serviceWorker; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openReader(page);
  await page.getByRole('button', { name: 'Сохранить выпуск без интернета', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить выпуск', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Сохранение недоступно');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'В начале — открыть пояснение' }).click();
  await expect(page.getByRole('heading', { name: 'Что означает начало', exact: true })).toBeVisible();
});

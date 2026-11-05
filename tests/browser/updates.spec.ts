import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

let server: Server;
let origin: string;
let changes = new Map<string, Buffer>();
let broken: 'http' | 'integrity' | null = null;
let failures = 0;
let nextManifest: Buffer;
let originalNotes: any[];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png' };

test.beforeAll(async () => {
  originalNotes = JSON.parse(await readFile('dist/content/notes.json', 'utf8'));
  const notes = structuredClone(originalNotes);
  notes[8].summary = `Обновлённый выпуск. ${notes[8].summary}`;
  const bytes = Buffer.from(JSON.stringify(notes));
  const manifestText = await readFile('dist/offline-assets.js', 'utf8');
  const manifest = JSON.parse(manifestText.slice(manifestText.indexOf('=') + 1).trim().replace(/;$/, ''));
  manifest.id = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  manifest.integrity['./content/notes.json'] = `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
  nextManifest = Buffer.from(`self.OFFLINE_RELEASE = ${JSON.stringify(manifest)};\n`);
  changes.set('/content/notes.json', bytes);
  server = createServer(async (request, response) => {
    const pathname = new URL(request.url!, 'http://localhost').pathname;
    response.setHeader('Cache-Control', 'no-store');
    if (pathname === '/content/notes.json' && broken) {
      failures++;
      response.writeHead(broken === 'http' ? 503 : 200, { 'Content-Type': 'application/json' });
      response.end(broken === 'http' ? 'Unavailable' : '["corrupted content"]');
      return;
    }
    try {
      const file = pathname === '/' ? '/index.html' : pathname;
      const bytes = changes.get(pathname) ?? await readFile(`dist${file}`);
      const extension = file.slice(file.lastIndexOf('.'));
      response.setHeader('Content-Type', types[extension] ?? 'application/octet-stream');
      response.end(bytes);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
test.beforeEach(() => { changes.delete('/offline-assets.js'); changes.delete('/content/notes.json'); broken = null; failures = 0; });

async function save(page) {
  await page.goto(origin);
  await expect(page.locator('.verse')).toHaveCount(34);
  await page.getByRole('button', { name: 'Сохранить выпуск без интернета', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить выпуск', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Выпуск на устройстве' })).toBeVisible();
  await page.keyboard.press('Escape');
}
function publishFixture() {
  const notes = structuredClone(originalNotes);
  notes[8].summary = `Обновлённый выпуск. ${notes[8].summary}`;
  changes.set('/content/notes.json', Buffer.from(JSON.stringify(notes)));
  changes.set('/offline-assets.js', nextManifest);
}
async function checkUpdates(page) {
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
}

test('a complete update waits for approval, refreshes both tabs, preserves place and font, and stays offline', async ({ page, context }) => {
  await save(page);
  const other = await context.newPage(); await other.goto(origin); await expect(other.locator('.verse')).toHaveCount(34);
  await page.getByRole('button', { name: 'Настройки чтения' }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Увеличить текст' }).click();
  await page.keyboard.press('Escape');
  await page.locator('#verse-1-26').scrollIntoViewIfNeeded();
  const before = await page.locator('#verse-1-26').evaluate(el => el.getBoundingClientRect().top);
  publishFixture(); await checkUpdates(page);
  await expect(page.getByRole('button', { name: 'Обновить', exact: true })).toBeVisible();
  expect(await page.evaluate(async () => (await (await fetch('./content/notes.json')).json())[8].summary)).toBe(originalNotes[8].summary);
  const reloaded = page.waitForEvent('load');
  const otherReloaded = other.waitForEvent('load');
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await Promise.all([reloaded, otherReloaded]);
  await expect(page.locator('.verse')).toHaveCount(34);
  await expect.poll(async () => page.evaluate(async () => (await (await fetch('./content/notes.json')).json())[8].summary)).toContain('Обновлённый выпуск.');
  await expect.poll(async () => other.evaluate(async () => (await (await fetch('./content/notes.json')).json())[8].summary)).toContain('Обновлённый выпуск.');
  await expect(page.locator('.verse p').first()).toHaveCSS('font-size', '24px');
  await expect.poll(async () => Math.abs((await page.locator('#verse-1-26').evaluate(el => el.getBoundingClientRect().top)) - before)).toBeLessThan(4);
  await context.setOffline(true); await page.reload(); await expect(page.locator('.verse')).toHaveCount(34);
  await page.getByRole('button', { name: 'сотворим — открыть пояснение', exact: true }).click();
  await expect(page.locator('.note-summary')).toContainText('Обновлённый выпуск.');
});

test('interrupted or corrupted updates keep the saved release and a later retry succeeds', async ({ page, context }) => {
  await save(page); publishFixture(); broken = 'http';
  await checkUpdates(page);
  await expect.poll(() => failures).toBeGreaterThan(0);
  await expect.poll(async () => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.installing?.state ?? 'none')).toBe('none');
  await expect(page.getByRole('button', { name: 'Обновить', exact: true })).toHaveCount(0);
  await context.setOffline(true); await page.reload(); await expect(page.locator('.verse')).toHaveCount(34);
  expect(await page.evaluate(async () => (await (await fetch('./content/notes.json')).json())[8].summary)).toBe(originalNotes[8].summary);
  await context.setOffline(false); broken = 'integrity'; failures = 0; await checkUpdates(page);
  await expect.poll(() => failures).toBeGreaterThan(0);
  await expect.poll(async () => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.installing?.state ?? 'none')).toBe('none');
  await expect(page.getByRole('button', { name: 'Обновить', exact: true })).toHaveCount(0);
  broken = null; await checkUpdates(page);
  await expect(page.getByRole('button', { name: 'Обновить', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Обновить', exact: true }).click();
  await expect.poll(async () => page.evaluate(async () => (await (await fetch('./content/notes.json')).json())[8].summary)).toContain('Обновлённый выпуск.');
});

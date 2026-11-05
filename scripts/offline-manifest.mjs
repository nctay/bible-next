import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function assets(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(entries.map(entry => entry.isDirectory() ? assets(`${directory}/${entry.name}`) : `${directory}/${entry.name}`));
  return paths.flat().filter(path => !['sw.js', 'offline-assets.js', '_headers', '_redirects'].includes(path.split('/').at(-1)));
}
const paths = (await assets('dist')).sort();
const hash = createHash('sha256');
hash.update(await readFile('dist/sw.js'));
for (const path of paths) { hash.update(path); hash.update(await readFile(path)); }
const id = hash.digest('hex').slice(0, 16);
const index = (await readFile('dist/index.html', 'utf8')).replace('</head>', `  <meta name="bible-release" content="${id}">\n  </head>`);
await writeFile('dist/index.html', index);
const integrity = {};
for (const path of paths) {
  const bytes = await readFile(path);
  integrity[`./${path.slice(5)}`] = `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
}
integrity['./'] = integrity['./index.html'];
const entrypoints = [...index.matchAll(/(?:src|href)="(\.\/assets\/[^"\s]+\.(?:js|css))"/g)].map(match => match[1]);
if (!entrypoints.length) throw new Error('Missing application entrypoints');
const release = { id, urls: ['./', ...paths.map(path => `./${path.slice(5)}`)], integrity, entrypoints };
await writeFile('dist/offline-assets.js', `self.OFFLINE_RELEASE = ${JSON.stringify(release)};\n`);
console.log(`Offline release ${release.id}: ${paths.length} files + start page`);

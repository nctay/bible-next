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
const integrity = {};
for (const path of paths) {
  const bytes = await readFile(path);
  hash.update(path); hash.update(bytes);
  integrity[`./${path.slice(5)}`] = `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
}
integrity['./'] = integrity['./index.html'];
const release = { id: hash.digest('hex').slice(0, 16), urls: ['./', ...paths.map(path => `./${path.slice(5)}`)], integrity };
await writeFile('dist/offline-assets.js', `self.OFFLINE_RELEASE = ${JSON.stringify(release)};\n`);
console.log(`Offline release ${release.id}: ${paths.length} files + start page`);

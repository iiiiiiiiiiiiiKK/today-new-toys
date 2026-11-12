/**
 * Build the self-hosted webfonts.
 *
 *   npm run fonts
 *
 * Downloads only the faces this site actually references. Today that is Archivo
 * Black (Latin display) and JetBrains Mono (metadata) — both declared in
 * `src/styles/base.css`. Noto Serif SC and Instrument Serif were removed from the
 * design system, so shipping them would be dead weight in every deploy.
 *
 * Re-run whenever the type stack changes. Nothing here is required for `npm run
 * build`; the fonts are committed under `public/fonts/`.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS } from './lib/fs.mjs';

const outDir = join(PATHS.root, 'public', 'fonts');
mkdirSync(outDir, { recursive: true });

const SOURCES = [
  {
    name: 'archivo-black-400',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/archivo-black@5.0.20/files/archivo-black-latin-400-normal.woff2',
  },
  {
    name: 'jetbrains-mono-400',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.0.0/files/jetbrains-mono-latin-400-normal.woff2',
  },
];

for (const font of SOURCES) {
  const target = join(outDir, `${font.name}.woff2`);
  if (existsSync(target)) {
    console.log(`${font.name}.woff2  已存在，跳过（${(readFileSync(target).length / 1024).toFixed(1)} KB）`);
    continue;
  }
  const res = await fetch(font.url);
  if (!res.ok) throw new Error(`${font.name}: HTTP ${res.status}`);
  writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  console.log(`${font.name}.woff2  ${(readFileSync(target).length / 1024).toFixed(1)} KB`);
}

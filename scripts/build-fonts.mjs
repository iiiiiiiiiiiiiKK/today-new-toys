/**
 * Build the self-hosted webfonts.
 *
 *   npm run fonts
 *
 * Downloads the Latin display/mono faces from jsDelivr and subsets Noto Serif SC
 * (Chinese headings) to only the characters this site actually uses — a full CJK
 * font is 2 MB per weight, the subset is a few hundred KB. Re-run this whenever
 * new Chinese copy is added so new glyphs are included; anything missing falls
 * back to the system serif, which is ugly but never broken.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS } from './lib/fs.mjs';

const outDir = join(PATHS.root, 'public', 'fonts');
mkdirSync(outDir, { recursive: true });

const SOURCES = [
  {
    name: 'instrument-serif-400',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/instrument-serif@5.0.8/files/instrument-serif-latin-400-normal.woff2',
    subset: false,
  },
  {
    name: 'instrument-serif-400-italic',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/instrument-serif@5.0.8/files/instrument-serif-latin-400-italic.woff2',
    subset: false,
  },
  {
    name: 'jetbrains-mono-400',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.0.0/files/jetbrains-mono-latin-400-normal.woff2',
    subset: false,
  },
  {
    name: 'noto-serif-sc-400',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.0.0/files/noto-serif-sc-chinese-simplified-400-normal.woff2',
    subset: true,
  },
  {
    name: 'noto-serif-sc-600',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-serif-sc@5.0.0/files/noto-serif-sc-chinese-simplified-600-normal.woff2',
    subset: true,
  },
];

function collectChars() {
  const chars = new Set();
  const add = (s) => {
    for (const ch of s) chars.add(ch);
  };
  // All editorial data (the source of truth for what visitors read)
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.(json|md|tsx?|css)$/.test(f.name)) add(readFileSync(p, 'utf8'));
    }
  };
  walk(join(PATHS.root, 'data'));
  walk(join(PATHS.root, 'src'));
  add('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');
  add('，。、；：？！“”‘’（）《》【】—…·×÷≈≤≥±°%‰￥$€£©®™→←↑↓★☆♥✓✕');
  return [...chars].join('');
}

const chars = collectChars();
const unicodeFile = join(outDir, '.chars.txt');
writeFileSync(unicodeFile, chars, 'utf8');
console.log(`字体子集字符数: ${[...chars].length}`);

for (const font of SOURCES) {
  const raw = join(outDir, `${font.name}.full.woff2`);
  if (!existsSync(raw)) {
    const res = await fetch(font.url);
    if (!res.ok) throw new Error(`${font.name}: HTTP ${res.status}`);
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  }
  const target = join(outDir, `${font.name}.woff2`);
  if (!font.subset) {
    writeFileSync(target, readFileSync(raw));
  } else {
    const textFile = join(outDir, `${font.name}.chars.txt`);
    writeFileSync(textFile, chars, 'utf8');
    execFileSync('python', [
      '-m',
      'fontTools.subset',
      raw,
      `--text-file=${textFile}`,
      `--output-file=${target}`,
      '--flavor=woff2',
      '--layout-features=*',
      '--no-hinting',
      '--desubroutinize',
    ]);
  }
  console.log(`${font.name}.woff2  ${(readFileSync(target).length / 1024).toFixed(0)} KB`);
}

for (const f of readdirSync(outDir)) {
  if (f.endsWith('.full.woff2') || f.endsWith('.chars.txt') || f === '.chars.txt') {
    const p = join(outDir, f);
    try {
      execFileSync('powershell', ['-NoProfile', '-Command', `Remove-Item -LiteralPath '${p.replace(/'/g, "''")}' -Force`]);
    } catch {
      /* leave it */
    }
  }
}

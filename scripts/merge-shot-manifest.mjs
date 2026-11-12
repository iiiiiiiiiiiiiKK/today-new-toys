/**
 * Merge screenshot-manifest entries that exist in a historical commit but are missing
 * from the local manifest.
 *
 * The manifest is a single file keyed by slug, so restoring per-slug screenshots
 * (restore-lost-projects.mjs) is not enough: without this merge the images are on disk
 * but `build-data.mjs` still renders no screenshot for those projects.
 *
 *   node scripts/merge-shot-manifest.mjs [--apply]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const OWNER = 'iiiiiiiiiiiiiKK';
const REPO = 'today-new-toys';
const SOURCE = process.env.SOURCE_COMMIT || 'd48addb';
const APPLY = process.argv.includes('--apply');

const H = {
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'manifest-merge',
};

const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/public/shots/manifest.json?ref=${SOURCE}`, {
  headers: H,
});
if (!res.ok) throw new Error(`manifest fetch -> ${res.status}`);
const remote = JSON.parse(Buffer.from((await res.json()).content, 'base64').toString('utf8'));

const localPath = 'public/shots/manifest.json';
const local = existsSync(localPath) ? JSON.parse(readFileSync(localPath, 'utf8')) : {};
const before = Object.keys(local).length;

const added = [];
const missingFiles = [];
for (const [slug, entry] of Object.entries(remote)) {
  if (local[slug]) continue;
  // `src` is site-absolute ("/shots/x.jpg"); on disk it lives under public/.
  const file = entry.src ? `public/${entry.src.replace(/^\//, '')}` : null;
  if (!file || !existsSync(file)) {
    missingFiles.push(slug);
    continue;
  }
  local[slug] = entry;
  added.push(slug);
}

console.log(`remote ${Object.keys(remote).length} / local before ${before}`);
console.log(`would add ${added.length}: ${added.join(', ') || '-'}`);
if (missingFiles.length) console.log(`skipped (image file absent): ${missingFiles.join(', ')}`);

if (APPLY && added.length) {
  // Keep the file readable: stable slug order, 2-space indent.
  const ordered = Object.fromEntries(Object.keys(local).sort().map((slug) => [slug, local[slug]]));
  writeFileSync(localPath, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');
  console.log(`wrote ${localPath} with ${Object.keys(ordered).length} entries`);
} else if (!APPLY) {
  console.log('dry run — pass --apply to write');
}

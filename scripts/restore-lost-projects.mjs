/**
 * Restore project files that were deleted by a tree-replacing push.
 *
 * Background: `upload-via-api.cjs` used to build the commit tree from local files
 * only. The daily bot commits new projects straight to `main`, so the next local push
 * silently removed them. Commit d48addb (73 projects) is the high-water mark; this
 * script copies the missing slugs' data + screenshots back into the working copy.
 *
 *   node scripts/restore-lost-projects.mjs [--apply]
 *
 * Without --apply it only reports what would be written.
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const OWNER = 'iiiiiiiiiiiiiKK';
const REPO = 'today-new-toys';
const SOURCE = process.env.SOURCE_COMMIT || 'd48addb';
const APPLY = process.argv.includes('--apply');
const TOKEN = process.env.GITHUB_TOKEN;

const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'restore-tool',
};

const api = async (p) => {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${p}`, { headers: H });
  if (!res.ok) throw new Error(`GET ${p} -> ${res.status}`);
  return res.json();
};

const blob = async (sha) => {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/git/blobs/${sha}`, { headers: H });
  if (!res.ok) throw new Error(`blob ${sha} -> ${res.status}`);
  const json = await res.json();
  return Buffer.from(json.content, json.encoding === 'base64' ? 'base64' : 'utf8');
};

const head = await api(`/git/trees/${SOURCE}?recursive=1`);
if (head.truncated) throw new Error('tree truncated');

// Which slugs exist at SOURCE but are gone from the current local copy?
const sourceProjects = head.tree
  .filter((n) => n.type === 'blob' && /^data\/projects\/[^/]+\.json$/.test(n.path))
  .map((n) => ({ path: n.path, slug: n.path.slice('data/projects/'.length, -5), sha: n.sha }));

const PREFIXES = ['data/projects/', 'data/repo/', 'data/readme/', 'public/shots/', 'public/og/'];
const targets = [];
for (const project of sourceProjects) {
  if (existsSync(join('.', project.path))) continue;
  const slug = project.slug;
  const related = head.tree.filter(
    (n) =>
      n.type === 'blob' &&
      PREFIXES.some((prefix) => {
        if (!n.path.startsWith(prefix)) return false;
        const rest = n.path.slice(prefix.length);
        return rest === `${slug}.json` || rest === `${slug}.jpg` || rest === `${slug}.webp` || rest === `${slug}.png` || rest.startsWith(`${slug}/`);
      }),
  );
  targets.push({ slug, files: related });
}

console.log(`source ${SOURCE}: ${sourceProjects.length} projects; missing locally: ${targets.length}`);
for (const t of targets) console.log(`  ${t.slug}: ${t.files.length} files`);

if (!APPLY) {
  console.log('\ndry run — pass --apply to write these files');
  process.exit(0);
}

let written = 0;
for (const t of targets) {
  for (const file of t.files) {
    mkdirSync(dirname(join('.', file.path)), { recursive: true });
    writeFileSync(join('.', file.path), await blob(file.sha));
    written += 1;
  }
}
console.log(`\nwrote ${written} files across ${targets.length} projects`);

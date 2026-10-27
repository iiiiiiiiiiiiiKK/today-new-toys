/**
 * Pull the repository's main branch into this working copy through the REST/raw API.
 *
 *   GITHUB_TOKEN=... OWNER=... REPO=... node scripts/pull-via-api.cjs
 *
 * Needed because outbound git:// and git-over-https are blocked in this environment
 * while api.github.com / raw.githubusercontent.com work. Compares git blob SHAs so
 * only changed files are downloaded.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.OWNER;
const REPO = process.env.REPO;
const BRANCH = process.env.BRANCH || 'main';
const DEST = process.env.LOCAL_ROOT || '.';
const DRY = process.env.DRY === '1';

const H = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'dsh' };

async function api(p) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${p}`, { headers: H });
  if (!res.ok) throw new Error(`GET ${p} -> ${res.status}`);
  return res.json();
}

function blobSha(buf) {
  return crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

(async () => {
  const ref = await api(`/git/ref/heads/${BRANCH}`);
  const tree = await api(`/git/trees/${ref.object.sha}?recursive=1`);
  const blobs = tree.tree.filter((e) => e.type === 'blob');

  let written = 0;
  let same = 0;
  for (const entry of blobs) {
    const local = path.join(DEST, entry.path);
    if (fs.existsSync(local)) {
      const stat = fs.statSync(local);
      // quick reject by size before hashing
      if (stat.size === entry.size && blobSha(fs.readFileSync(local)) === entry.sha) {
        same += 1;
        continue;
      }
    }
    if (DRY) {
      console.log('would update', entry.path);
      written += 1;
      continue;
    }
    const raw = await fetch(`https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${entry.path.split('/').map(encodeURIComponent).join('/')}`, {
      headers: { 'User-Agent': 'dsh' },
    });
    if (!raw.ok) {
      console.warn('skip', entry.path, raw.status);
      continue;
    }
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.writeFileSync(local, Buffer.from(await raw.arrayBuffer()));
    written += 1;
    if (written % 20 === 0) console.log(`  downloaded ${written}`);
  }
  console.log(`done: ${written} updated, ${same} unchanged, ${blobs.length} files at ${ref.object.sha.slice(0, 7)}`);
})();

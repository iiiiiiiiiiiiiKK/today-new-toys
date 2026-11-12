/**
 * Push a local directory to a GitHub repo via the REST API (no git binary needed).
 *
 *   TOKEN=... OWNER=... REPO=... LOCAL_ROOT=... node upload-via-api.cjs
 *
 * Used because outbound git/443 is blocked in this environment while api.github.com
 * works.
 *
 * IMPORTANT — this tool MERGES with the remote tree, it does not replace it:
 * a local working copy is almost never a superset of the repo (the daily bot commits
 * new projects straight to main). Building a tree from local files alone silently
 * deletes everything the local copy is missing. We therefore start from the remote
 * tree and overlay local files on top; deletion only happens for paths listed in
 * DELETE_PATHS. Content-addressed: unchanged files are skipped via the sha cache.
 */
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.OWNER;
const REPO = process.env.REPO;
const BRANCH = process.env.BRANCH || 'main';
const LOCAL_ROOT = process.env.LOCAL_ROOT;
const MESSAGE = process.env.COMMIT_MSG || 'chore: sync';
const CACHE_FILE = process.env.CACHE_FILE || '.upload-cache.json';
const ORPHAN = process.env.ORPHAN === '1';
/** Comma-separated repo-relative paths to remove. Nothing else is ever deleted. */
const DELETE_PATHS = (process.env.DELETE_PATHS || '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

if (!TOKEN || !OWNER || !REPO || !LOCAL_ROOT) {
  console.error('需要 GITHUB_TOKEN / OWNER / REPO / LOCAL_ROOT');
  process.exit(1);
}

const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'dsh-uploader',
  'Content-Type': 'application/json',
};

async function api(p, opts = {}, retries = 4) {
  let last;
  for (let t = 0; t < retries; t++) {
    try {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${p}`, { ...opts, headers: H });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
      if (!res.ok) throw new Error(`${opts.method || 'GET'} ${p} -> ${res.status}: ${String(text).slice(0, 220)}`);
      return json;
    } catch (error) {
      last = error;
      if (/-> 4\d\d/.test(error.message)) throw error;
      await new Promise((r) => setTimeout(r, 1500 * (t + 1)));
    }
  }
  throw last;
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.tmp-e2e',
  '.tmp-shots',
  '.tmp-shots2',
  '.tmp-shots-review',
  '.tmp-device',
  '.tmp-visual',
]);

function walk(dir, base = '') {
  let out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out = out.concat(walk(path.join(dir, entry.name), rel));
    } else out.push(rel);
  }
  return out;
}

const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};

(async () => {
  const repoInfo = await api('');
  console.log(`repo: ${repoInfo.full_name}  private: ${repoInfo.private}`);

  // Empty repos reject git/blobs with 409, so bootstrap with one Contents API commit
  // unless the caller explicitly wants a single squashed "initial" commit.
  let baseBranch = ORPHAN ? null : await api(`/git/ref/heads/${BRANCH}`).catch(() => null);
  if (!baseBranch && !ORPHAN) {
    console.log('repo is empty — bootstrapping initial commit with README.md');
    const readme = fs.readFileSync(path.join(LOCAL_ROOT, 'README.md'));
    await api('/contents/README.md', {
      method: 'PUT',
      body: JSON.stringify({
        message: 'chore: initialize repository',
        content: readme.toString('base64'),
        branch: BRANCH,
      }),
    });
    baseBranch = await api(`/git/ref/heads/${BRANCH}`);
  }
  const baseCommit = baseBranch ? await api(`/git/commits/${baseBranch.object.sha}`) : null;
  console.log(baseBranch ? `branch: ${baseBranch.object.sha.slice(0, 7)}` : 'orphan commit mode');

  // ---- remote tree (the source of truth we must not shrink) ------------------
  const remoteEntries = new Map();
  if (baseCommit) {
    const remoteTree = await api(`/git/trees/${baseCommit.tree.sha}?recursive=1`);
    if (remoteTree.truncated) {
      console.error('远端 tree 被截断，拒绝继续（会误删文件）。请先用 git 同步一次。');
      process.exit(1);
    }
    for (const item of remoteTree.tree) {
      if (item.type === 'blob') remoteEntries.set(item.path, item.sha);
    }
    console.log(`remote tree: ${remoteEntries.size} blobs`);
  }

  const deleteSet = new Set(DELETE_PATHS.map((p) => p.replace(/^\/+/, '')));
  for (const p of deleteSet) {
    if (!remoteEntries.has(p)) console.log(`  delete: ${p} (not on remote, skipped)`);
    remoteEntries.delete(p);
  }

  // ---- overlay local files --------------------------------------------------
  const files = walk(LOCAL_ROOT);
  console.log(`local files: ${files.length}`);

  const entries = [];
  let uploaded = 0;
  let reused = 0;
  let keptRemote = 0;

  for (const rel of files) {
    if (deleteSet.has(rel)) continue;
    const abs = path.join(LOCAL_ROOT, rel);
    const buf = fs.readFileSync(abs);
    const key = `${rel}:${buf.length}`;
    if (cache[key]) {
      entries.push({ path: rel, mode: '100644', type: 'blob', sha: cache[key] });
      reused += 1;
      continue;
    }
    const blob = await api('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: buf.toString('base64'), encoding: 'base64' }),
    });
    cache[key] = blob.sha;
    entries.push({ path: rel, mode: '100644', type: 'blob', sha: blob.sha });
    uploaded += 1;
    if (uploaded % 25 === 0) {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');
      console.log(`  uploaded ${uploaded}/${files.length}`);
    }
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf8');

  const localPaths = new Set(files);
  for (const [rel, sha] of remoteEntries) {
    if (localPaths.has(rel)) continue; // local version already wins above
    entries.push({ path: rel, mode: '100644', type: 'blob', sha });
    keptRemote += 1;
  }

  console.log(`blobs: uploaded ${uploaded}, cached ${reused}; kept ${keptRemote} remote-only files; deleted ${deleteSet.size}`);
  if (keptRemote > 0) {
    const sample = [...remoteEntries.keys()].filter((p) => !localPaths.has(p)).slice(0, 5);
    console.log(`  preserved examples: ${sample.join(', ')}`);
  }

  const tree = await api('/git/trees', {
    method: 'POST',
    body: JSON.stringify({ tree: entries }),
  });
  console.log('tree:', tree.sha);

  const commit = await api('/git/commits', {
    method: 'POST',
    body: JSON.stringify({
      message: MESSAGE,
      tree: tree.sha,
      parents: baseCommit ? [baseCommit.sha] : [],
    }),
  });
  console.log('commit:', commit.sha);

  if (baseBranch) {
    await api(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
  } else {
    await api('/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: commit.sha }) });
  }
  console.log(`pushed to ${OWNER}/${REPO}#${BRANCH}`);
})();

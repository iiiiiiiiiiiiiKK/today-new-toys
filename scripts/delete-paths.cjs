/**
 * Delete specific paths from a GitHub repo with a single commit (REST API).
 *   node scripts/delete-paths.cjs path1 path2 ...
 */
const fs = require('fs');

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.OWNER;
const REPO = process.env.REPO;
const BRANCH = process.env.BRANCH || 'main';
const MESSAGE = process.env.COMMIT_MSG || 'chore: remove generated files';
const CACHE_FILE = process.env.CACHE_FILE || '.upload-cache.json';
const REMOVE = process.argv.slice(2);

const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'dsh-uploader',
  'Content-Type': 'application/json',
};

async function api(p, opts = {}) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${p}`, { ...opts, headers: H });
  const text = await res.text();
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${p} -> ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

(async () => {
  const ref = await api(`/git/ref/heads/${BRANCH}`);
  const head = await api(`/git/commits/${ref.object.sha}`);
  const baseTree = await api(`/git/trees/${head.tree.sha}?recursive=1`);

  const keep = baseTree.tree.filter((e) => e.type === 'blob' && !REMOVE.includes(e.path));
  const removed = baseTree.tree.filter((e) => REMOVE.includes(e.path));
  console.log('removing:', removed.map((e) => e.path).join(', ') || '(none)');
  if (!removed.length) return;

  const tree = await api('/git/trees', {
    method: 'POST',
    body: JSON.stringify({ tree: keep.map((e) => ({ path: e.path, mode: e.mode, type: 'blob', sha: e.sha })) }),
  });
  const commit = await api('/git/commits', {
    method: 'POST',
    body: JSON.stringify({ message: MESSAGE, tree: tree.sha, parents: [head.sha] }),
  });
  await api(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
  console.log('commit:', commit.sha);
  fs.writeFileSync(CACHE_FILE + '.delete-log', JSON.stringify({ commit: commit.sha, removed: REMOVE }));
})();

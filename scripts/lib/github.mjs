/**
 * Minimal GitHub REST client for the ingest scripts.
 *
 * Rules:
 *  - The token is read from `GITHUB_TOKEN` in the *build/maintenance* environment only.
 *    It is never written to disk, never inlined into data files, and never shipped
 *    to the browser (there is no server component at all).
 *  - Every call is logged with status + remaining quota so the run log is auditable.
 *  - Failures are returned as structured results, not thrown, so `import` can fall
 *    back to "manual add" instead of losing the user's input.
 */

export const API = 'https://api.github.com';

export function parseRepoInput(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  // git@github.com:owner/repo.git
  const ssh = raw.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (ssh) return { owner: ssh[1], repo: ssh[2] };
  // plain owner/repo
  const plain = raw.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (plain) return { owner: plain[1], repo: plain[2] };
  try {
    const url = new URL(raw);
    if (!/(^|\.)github\.com$/i.test(url.hostname)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

export function createClient({ token = process.env.GITHUB_TOKEN, log = () => {}, fetchImpl = fetch } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'today-new-toys-ingest/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const state = { remaining: null, limit: null, reset: null, calls: 0, authenticated: Boolean(token) };

  async function request(path, { allow404 = false } = {}) {
    const url = path.startsWith('http') ? path : `${API}${path}`;
    state.calls += 1;
    const started = Date.now();
    let res;
    try {
      res = await fetchImpl(url, { headers, redirect: 'follow' });
    } catch (error) {
      log({ event: 'http_error', url, error: String(error?.message || error), ms: Date.now() - started });
      return { ok: false, status: 0, error: String(error?.message || error), data: null };
    }
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining !== null) state.remaining = Number(remaining);
    const limit = res.headers.get('x-ratelimit-limit');
    if (limit !== null) state.limit = Number(limit);
    const reset = res.headers.get('x-ratelimit-reset');
    if (reset !== null) state.reset = Number(reset);

    if (res.status === 404 && allow404) {
      log({ event: 'http_404', url, status: 404, ms: Date.now() - started });
      return { ok: false, status: 404, error: 'not found', data: null };
    }
    if (!res.ok) {
      let body = '';
      try {
        body = (await res.text()).slice(0, 300);
      } catch {
        /* ignore */
      }
      if (res.status === 403 && /rate limit/i.test(body)) {
        const wait = state.reset ? Math.max(0, state.reset * 1000 - Date.now()) : 0;
        log({ event: 'rate_limited', url, resetInSeconds: Math.ceil(wait / 1000), authenticated: state.authenticated });
        return { ok: false, status: 403, error: `rate limited; resets in ${Math.ceil(wait / 60000)} min`, data: null };
      }
      log({ event: 'http_fail', url, status: res.status, body, ms: Date.now() - started });
      return { ok: false, status: res.status, error: body || `HTTP ${res.status}`, data: null };
    }
    const data = await res.json();
    log({ event: 'http_ok', url, status: res.status, remaining: state.remaining, ms: Date.now() - started });
    return { ok: true, status: res.status, data };
  }

  async function repo(owner, name) {
    return request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, { allow404: true });
  }

  /**
   * README is fetched from the API (respects auth / private repos) and falls back to
   * raw.githubusercontent.com, which does not consume API quota.
   */
  async function readme(owner, name, branch = 'main') {
    const viaApi = await request(`/repos/${owner}/${name}/readme`, { allow404: true });
    if (viaApi.ok && viaApi.data?.content) {
      const text = Buffer.from(viaApi.data.content, viaApi.data.encoding || 'base64').toString('utf8');
      return { ok: true, path: viaApi.data.path || 'README', text, via: 'api' };
    }
    for (const ref of [branch, 'master']) {
      try {
        const res = await fetchImpl(`https://raw.githubusercontent.com/${owner}/${name}/${ref}/README.md`, {
          headers: { 'User-Agent': 'today-new-toys-ingest/1.0' },
        });
        if (res.ok) return { ok: true, path: 'README.md', text: await res.text(), via: 'raw' };
      } catch (error) {
        log({ event: 'raw_readme_error', ref, error: String(error?.message || error) });
      }
    }
    return { ok: false, path: null, text: null, via: null };
  }

  return { repo, readme, request, state };
}

/** Strip markup down to readable plain text and keep only the first `limit` chars. */
export function digestReadme(markdown, { limit = 1400 } = {}) {
  if (!markdown) return { excerpt: null, headings: [], chars: 0, truncated: false };
  const text = String(markdown).replace(/\r\n/g, '\n');
  const headings = [...text.matchAll(/^#{1,3}\s+(.+)$/gm)]
    .map((m) =>
      m[1]
        // headings often carry inline anchors: "Configuration<a id="configuration"></a>"
        .replace(/<[^>]*>/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/[*_`#]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 40);
  const withoutBadges = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_>|]/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
  const chars = withoutBadges.length;
  const excerpt = withoutBadges.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').slice(0, limit);
  return { excerpt, headings, chars, truncated: chars > limit };
}

export function normalizeLicense(license) {
  if (!license || !license.spdx_id || license.spdx_id === 'NOASSERTION') {
    return {
      spdx: null,
      name: license?.name && license.name !== 'NOASSERTION' ? license.name : null,
      note: 'GitHub 未识别到许可证文件；使用前请自行查看仓库 LICENSE',
      url: null,
    };
  }
  return { spdx: license.spdx_id, name: license.name || license.spdx_id, url: null };
}

export function repoRecord(json, fetchedAt = new Date().toISOString()) {
  return {
    owner: json.owner?.login ?? null,
    name: json.name ?? null,
    fullName: json.full_name ?? null,
    url: json.html_url ?? null,
    homepage: json.homepage || null,
    description: json.description || null,
    stars: typeof json.stargazers_count === 'number' ? json.stargazers_count : null,
    forks: typeof json.forks_count === 'number' ? json.forks_count : null,
    openIssues: typeof json.open_issues_count === 'number' ? json.open_issues_count : null,
    language: json.language || null,
    topics: Array.isArray(json.topics) ? json.topics : [],
    license: normalizeLicense(json.license),
    createdAt: json.created_at || null,
    pushedAt: json.pushed_at || null,
    archived: typeof json.archived === 'boolean' ? json.archived : null,
    fetchedAt,
    source: 'api',
    warnings: [],
  };
}

export function statusFromRepo(repo) {
  if (repo.archived) return 'archived';
  if (!repo.pushedAt) return 'unknown';
  const days = (Date.now() - new Date(repo.pushedAt).getTime()) / 86_400_000;
  if (days <= 120) return 'active';
  if (days <= 540) return 'stale';
  return 'unknown';
}

/**
 * Read a repo's README as plain text for the optional AI drafting step.
 * Kept separate so `verify`/`update` never pay for it.
 */
export async function fetchReadmeText(owner, name, branch = 'main', fetchImpl = fetch) {
  for (const ref of [branch, 'main', 'master']) {
    try {
      const res = await fetchImpl(`https://raw.githubusercontent.com/${owner}/${name}/${ref}/README.md`, {
        headers: { 'User-Agent': 'today-new-toys-ingest/1.0' },
      });
      if (res.ok) return await res.text();
    } catch {
      /* try next ref */
    }
  }
  return '';
}

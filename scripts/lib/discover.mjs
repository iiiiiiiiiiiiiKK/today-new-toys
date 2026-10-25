/**
 * Candidate discovery for the automatic pipeline.
 *
 * One GitHub search per category (search API is the scarce resource: 10/min
 * anonymous, 30/min with a token), then cheap client-side scoring. Everything the
 * site will publish still comes from the repo API + README, so discovery only
 * decides *what* to look at, never *what to claim*.
 */

export const CATEGORY_QUERIES = [
  { category: 'ai-tools', q: 'topic:llm stars:>3000' },
  { category: 'dev-tools', q: 'topic:developer-tools stars:>2000' },
  { category: 'productivity', q: 'topic:productivity stars:>1500' },
  { category: 'data-viz', q: 'topic:data-visualization stars:>800' },
  { category: 'creative', q: 'topic:creative-coding stars:>800' },
  { category: 'learning', q: 'topic:tutorial stars:>3000' },
  { category: 'hardware', q: 'topic:firmware stars:>1000' },
  { category: 'internet-toys', q: 'topic:webapp stars:>1500' },
  { category: 'self-hosted', q: 'topic:self-hosted stars:>2000' },
  { category: 'web3', q: 'topic:ethereum stars:>1000' },
];

const DAY = 86_400_000;

/** Freshness / quality gates. Deliberately conservative: better to add nothing than noise. */
export function acceptable(repo, now = Date.now()) {
  if (repo.archived) return false;
  if (repo.fork) return false;
  // Curated "awesome-*" lists are directories, not things you can run. The site is a
  // catalogue of tools, so they're out of scope for the automatic lane.
  const topics = repo.topics ?? [];
  if (/^awesome[-_]/i.test(repo.name || '') || topics.includes('awesome-list') || topics.includes('awesome')) return false;
  if (!repo.description || repo.description.trim().length < 12) return false;
  if ((repo.stargazers_count ?? 0) < 800) return false;
  if (!repo.pushed_at) return false;
  if (now - new Date(repo.pushed_at).getTime() > 150 * DAY) return false;
  // A repo with no detectable licence is publishable *if* we say so — but for the
  // automated lane we prefer ones we can state clearly. Missing licence is allowed
  // only when the repo actually has a LICENSE file (checked later by the importer).
  return true;
}

export function scoreRepo(repo, now = Date.now()) {
  const stars = repo.stargazers_count ?? 0;
  const days = (now - new Date(repo.pushed_at || 0).getTime()) / DAY;
  const recency = Math.max(0, 40 - Math.min(40, days / 4));
  const docs = repo.homepage ? 6 : 0;
  const licence = repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION' ? 4 : 0;
  const desc = Math.min(10, (repo.description?.length ?? 0) / 12);
  return Math.log10(stars + 1) * 22 + recency + docs + licence + desc;
}

export function searchUrl({ category, q }, page = 1) {
  const pushed = new Date(Date.now() - 120 * DAY).toISOString().slice(0, 10);
  const query = `${q} pushed:>${pushed} archived:false fork:false`;
  return `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=8&page=${page}`;
}

/**
 * Picks up to `limit` new repos across categories, skipping anything already in the
 * catalogue (by full name, by name, or by homepage).
 */
export function pickCandidates(results, existing, limit) {
  const seenRepos = new Set(existing.map((e) => (e.repo || '').toLowerCase()));
  const seenNames = new Set(existing.map((e) => (e.name || '').toLowerCase()));
  const seenSites = new Set(existing.map((e) => normalizeSite(e.site)).filter(Boolean));

  const pool = [];
  for (const { category, repos } of results) {
    for (const repo of repos) {
      if (!acceptable(repo)) continue;
      const full = (repo.full_name || '').toLowerCase();
      const name = (repo.name || '').toLowerCase();
      const site = normalizeSite(repo.homepage);
      if (seenRepos.has(full) || seenNames.has(name) || (site && seenSites.has(site))) continue;
      pool.push({ category, repo, score: scoreRepo(repo) });
    }
  }
  // one per category first, so a run never floods a single section
  const byCategory = new Map();
  for (const item of pool.sort((a, b) => b.score - a.score)) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category).push(item);
  }
  const picked = [];
  let round = 0;
  const taken = new Set();
  while (picked.length < limit && round < 4) {
    for (const [category, items] of byCategory) {
      const next = items[round];
      if (!next || picked.length >= limit) continue;
      // the same repo often matches several category queries — claim it once
      if (taken.has(next.repo.id) || taken.has((next.repo.full_name || '').toLowerCase())) continue;
      taken.add(next.repo.id);
      taken.add((next.repo.full_name || '').toLowerCase());
      picked.push(next);
    }
    round += 1;
  }
  return picked;
}

function normalizeSite(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

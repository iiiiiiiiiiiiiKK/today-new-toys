/**
 * Momentum signals — only things we can actually measure.
 *
 * Two problems this file solves:
 *
 * 1. "How many stars did this repo gain today / this week / this month?"
 *    GitHub's `stargazers` endpoint with `starred_at` (the only honest way to answer
 *    that in one call) is not available on this deployment. So we record our own
 *    snapshots: every fetch appends `{ date, stars }` to `data/history/<slug>.json`.
 *    A 7-day delta is then `stars(now) - stars(7 days ago)` — a real number, or
 *    `null` with a reason when we do not have a snapshot that old yet.
 *
 * 2. "Is this project actually alive?"
 *    `stats/participation` gives 52 weeks of weekly commit counts, and `releases`
 *    gives real version events. Both are fetched here and stored verbatim.
 *
 * Nothing in this file estimates, smooths or back-fills. Missing stays missing.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS, readJson, writeJson } from './fs.mjs';

const HISTORY_DIR = join(PATHS.root, 'data', 'history');

/** Star counts recorded per calendar day (UTC). One entry per day, last write wins. */
export function recordStarHistory(slug, snapshot) {
  const file = join(HISTORY_DIR, `${slug}.json`);
  const history = readJson(file, { slug, points: [] }) ?? { slug, points: [] };
  const date = (snapshot.fetchedAt || new Date().toISOString()).slice(0, 10);
  const stars = typeof snapshot.stars === 'number' ? snapshot.stars : null;
  if (stars === null) return history;

  const existing = history.points.findIndex((p) => p.date === date);
  const point = { date, stars };
  if (existing >= 0) history.points[existing] = point;
  else history.points.push(point);

  history.points.sort((a, b) => a.date.localeCompare(b.date));
  // Keep a year; enough for every window we rank on.
  history.points = history.points.slice(-400);
  writeJson(file, history);
  return history;
}

/** Star history for one project, oldest first. */
export function readStarHistory(slug) {
  const file = join(HISTORY_DIR, `${slug}.json`);
  if (!existsSync(file)) return [];
  return (readJson(file, { points: [] })?.points ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Stars gained in the last `days` days, or `null` when no snapshot is old enough.
 * `today` is the snapshot date (YYYY-MM-DD) so builds are deterministic.
 */
export function starDelta(points, today, days) {
  if (!points.length) return null;
  const cutoff = new Date(`${today}T00:00:00Z`).getTime() - days * 86_400_000;
  const cutoffDate = new Date(cutoff).toISOString().slice(0, 10);
  const latest = points[points.length - 1];
  // The baseline must be at least `days` old, otherwise the delta would be a
  // shorter window wearing a longer label.
  const baseline = [...points].reverse().find((p) => p.date <= cutoffDate);
  if (!baseline || baseline.date === latest.date) return null;
  return { delta: latest.stars - baseline.stars, from: baseline.date, to: latest.date, days };
}

/** Commit counts: 52 weeks of weekly totals, plus the windows we display. */
export async function fetchActivity(client, owner, repo) {
  const res = await client.request(`/repos/${owner}/${repo}/stats/participation`, { allow404: true });
  if (!res.ok || !Array.isArray(res.data?.all)) return null;
  const weeks = res.data.all.filter((n) => Number.isFinite(n));
  if (!weeks.length) return null;
  const sum = (n) => weeks.slice(-n).reduce((a, b) => a + b, 0);
  return {
    weekly: weeks,
    commits52w: sum(weeks.length),
    commits4w: sum(4),
    commits1w: sum(1),
    fetchedAt: new Date().toISOString(),
  };
}

/** Latest releases (real version events). Prefers the newest stable one. */
export async function fetchReleases(client, owner, repo, limit = 5) {
  const res = await client.request(`/repos/${owner}/${repo}/releases?per_page=${limit}`, { allow404: true });
  if (!res.ok || !Array.isArray(res.data)) return [];
  return res.data.slice(0, limit).map((r) => ({
    tag: r.tag_name ?? null,
    name: r.name ?? null,
    url: r.html_url ?? null,
    publishedAt: r.published_at ?? null,
    prerelease: Boolean(r.prerelease),
    draft: Boolean(r.draft),
  }));
}

/** Total commit count from the pagination Link header (page × per_page). */
export async function fetchCommitTotal(client, owner, repo) {
  const res = await client.request(`/repos/${owner}/${repo}/commits?per_page=1`, { allow404: true });
  if (!res.ok) return null;
  return res.total ?? null;
}

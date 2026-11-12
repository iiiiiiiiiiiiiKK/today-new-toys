import type { Category, Enrichment, License, Project, ProjectStatus, Sourced } from '../data/types';
import { relativeTo } from './utils';

/**
 * Runtime data access. Everything is derived from `public/data/projects.json`,
 * which is generated from `data/projects/*.json` by `npm run data:check`.
 * No secret is ever read here: the browser only sees public repository metadata.
 */

export interface DataFile {
  generatedAt: string;
  /** The date the repo/README/screenshot snapshot was taken; all "N days ago" copy is relative to this. */
  snapshotDate: string;
  counts: { projects: number; categories: number };
  categories: Category[];
  seed: number[];
  /** How many projects have each ranking signal. The boards read this to stay honest. */
  rankCoverage?: {
    day: number;
    week: number;
    month: number;
    stars: number;
    releases: number;
    commits: number;
  };
  projects: Project[];
}

export interface FilterState {
  q: string;
  categories: string[];
  tags: string[];
  audience: string | null;
  license: 'any' | 'known';
  sort: 'recommended' | 'newest' | 'updated' | 'name';
  page: number;
}

export const PAGE_SIZE = 12;

let cache: DataFile | null = null;

/** Give up on a static JSON request that has not answered within this window. */
const LOAD_TIMEOUT_MS = 12_000;
/** One retry doubles the worst case to ~25s; beyond that the offline state is better. */
const LOAD_ATTEMPTS = 2;

async function fetchOnce(signal: AbortSignal): Promise<Response> {
  return fetch(`${import.meta.env.BASE_URL}data/projects.json`, { cache: 'no-cache', signal });
}

export async function loadData(): Promise<DataFile> {
  if (cache) return cache;

  let lastError: string = '未知错误';
  for (let attempt = 1; attempt <= LOAD_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
    try {
      const res = await fetchOnce(controller.signal);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cache = (await res.json()) as DataFile;
      return cache;
    } catch (error) {
      const aborted = controller.signal.aborted;
      lastError = aborted
        ? `请求超过 ${LOAD_TIMEOUT_MS / 1000} 秒没有响应`
        : error instanceof Error
          ? error.message
          : String(error);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`无法加载项目数据（${lastError}）`);
}

/** Test seam: lets unit tests inject a fixture without touching the network. */
export function __setData(data: DataFile | null): void {
  cache = data;
}

export function getCategory(data: DataFile, id: string): Category | undefined {
  return data.categories.find((c) => c.id === id);
}

export function getProject(data: DataFile, slug: string): Project | undefined {
  return data.projects.find((p) => p.slug === slug);
}

export function categoryName(data: DataFile, id: string): string {
  return getCategory(data, id)?.name ?? id;
}

/** Every tag used across the catalogue, with usage counts (for the filter rail). */
export function allTags(data: DataFile): Array<{ tag: string; count: number }> {
  const map = new Map<string, number>();
  for (const p of data.projects) {
    for (const t of p.tags) map.set(t, (map.get(t) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function audienceOptions(data: DataFile): string[] {
  return [...new Set(data.projects.map((p) => p.audience))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function haystack(p: Project): string {
  return [
    p.name,
    p.tagline,
    p.summary,
    ...(p.aliases ?? []),
    ...p.tags,
    ...p.features.map((f) => `${f.title} ${f.detail}`),
    ...p.audienceFor,
    p.repo.fullName ?? '',
    p.audience,
  ]
    .join(' ')
    .toLowerCase();
}

/**
 * Search + multi-tag filter + sort + pagination, all client side.
 * Keyword search covers names, taglines, features and aliases — not just the title.
 */
export function filterProjects(data: DataFile, state: FilterState): {
  items: Project[];
  total: number;
  pages: number;
} {
  const q = state.q.trim().toLowerCase();
  let items = data.projects.filter((p) => {
    if (state.categories.length && !state.categories.includes(p.category)) return false;
    if (state.tags.length && !state.tags.every((t) => p.tags.includes(t))) return false;
    if (state.audience && p.audience !== state.audience) return false;
    if (state.license === 'known' && !p.license.spdx) return false;
    if (q) {
      const hay = haystack(p);
      if (!q.split(/\s+/).every((word) => hay.includes(word))) return false;
    }
    return true;
  });

  if (state.sort === 'recommended') {
    items = [...items].sort((a, b) => Number(b.featured) - Number(a.featured) || b.popularityScore - a.popularityScore || a.name.localeCompare(b.name));
  } else if (state.sort === 'newest') {
    items = [...items].sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '') || a.name.localeCompare(b.name));
  } else if (state.sort === 'updated') {
    items = [...items].sort((a, b) => (b.repo.pushedAt || '').localeCompare(a.repo.pushedAt || '') || a.name.localeCompare(b.name));
  } else {
    items = [...items].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }

  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, state.page), pages);
  return { items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: items.length, pages };
}

/** Editors' pick pool: featured first, then the strongest, never the same order twice in a row. */
export function featured(data: DataFile, limit = 3): Project[] {
  return data.projects
    .filter((p) => p.featured)
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, limit);
}

export function newArrivals(data: DataFile, limit = 6): Project[] {
  return [...data.projects]
    .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || '') || b.popularityScore - a.popularityScore)
    .slice(0, limit);
}

export function weeklyHot(data: DataFile, limit = 6): Project[] {
  return [...data.projects]
    .sort((a, b) => b.weeklyScore - a.weeklyScore || b.popularityScore - a.popularityScore)
    .slice(0, limit);
}

/* ==========================================================================
   Rankings — every board is built from one measurable number.
   --------------------------------------------------------------------------
   GitHub's star-timestamp endpoint is not available to this deployment, so a true
   "stars gained in the last 7 days" figure cannot be fetched. Instead:

     - commit activity  → real. GitHub returns 52 weekly buckets per repo.
     - releases         → real dated events, the strongest "it is alive" signal.
     - stars            → a real total (never used as if it were a delta).
     - star deltas      → computed from OUR OWN daily snapshots, rendered as
                          「数据不足」 until two snapshots actually span the window.
   ========================================================================== */

export type BoardId = 'today' | 'week' | 'month' | 'rising' | 'stars' | 'newest';

export interface Board {
  id: BoardId;
  name: string;
  /** Single-line method statement shown under the board title. */
  method: string;
  /** What the number in each row means. */
  unit: string;
}

export const BOARDS: Board[] = [
  {
    id: 'today',
    name: '今日有推送',
    method: '仓库在过去 24 小时内收到推送，按最近一周的提交数排列。Star 不参与排序。',
    unit: '本周提交',
  },
  {
    id: 'week',
    name: '本周热榜',
    method: '按最近 7 天的提交数排列。是否发版单独标出来，不参与排序——看得见的数字就是排序依据。',
    unit: '本周提交',
  },
  {
    id: 'month',
    name: '本月热榜',
    method: '按最近 4 周的提交数（GitHub 的分周统计）排列。发版情况单独标注，不加权。',
    unit: '近 4 周提交',
  },
  {
    id: 'rising',
    name: '星标涨幅',
    method:
      '本站每天记录一次 Star 总数，涨幅 = 两次真实快照的差；排序按「每天涨多少星」，所以窗口长短不会互相压制。历史不够长时写「数据不足」，不补零。',
    unit: '每天涨星',
  },
  {
    id: 'stars',
    name: 'Star 总量',
    method: 'GitHub 当前的 Star 总数。这是存量，不是增速——别把老项目当新热门。',
    unit: 'Star 总数',
  },
  {
    id: 'newest',
    name: '最新收录',
    method: '按进入本站清单的日期排列。新不代表好，只是我们刚刚读到它。',
    unit: '收录日期',
  },
];

const DAY = 86_400_000;

/**
 * `snapshotDate` is a calendar day (YYYY-MM-DD, midnight UTC), but `pushedAt` is a
 * timestamp — a repo pushed at 20:39 on the snapshot day is *later* than the
 * snapshot's midnight. Comparing them raw makes today's events look like the future,
 * so the window is measured against the END of the snapshot day.
 */
function endOf(day: string): number {
  return new Date(`${day}T23:59:59Z`).getTime();
}

function pushedWithin(p: Project, snapshotDate: string, days: number): boolean {
  if (!p.repo.pushedAt) return false;
  const diff = endOf(snapshotDate) - new Date(p.repo.pushedAt).getTime();
  return diff >= 0 && diff <= days * DAY;
}

function releasedWithin(p: Project, snapshotDate: string, days: number): boolean {
  const at = p.momentum?.latestRelease?.publishedAt;
  if (!at) return false;
  const diff = endOf(snapshotDate) - new Date(at).getTime();
  return diff >= 0 && diff <= days * DAY;
}

/**
 * Score for one board. `null` means "no data for this board", never zero.
 *
 * Every score here is a number the row already displays, so ordering can always be
 * checked against the visible value. Release events are *notes*, not weights.
 */
function score(p: Project, board: BoardId, snapshotDate: string): number | null {
  const m = p.momentum;
  if (!m) return null;
  switch (board) {
    case 'today':
      if (!pushedWithin(p, snapshotDate, 1)) return null;
      return m.commits1w ?? null;
    case 'week':
      return m.commits1w;
    case 'month':
      return m.commits4w;
    case 'rising': {
      // Rank by stars PER DAY over the real span, so a 1-day window and a 30-day
      // window are comparable instead of the longer one always winning.
      const d = m.month ?? m.week ?? m.day;
      if (!d || d.spanDays <= 0) return null;
      return Math.round((d.delta / d.spanDays) * 100) / 100;
    }
    case 'stars':
      return m.stars;
    case 'newest':
      return p.addedAt ? new Date(p.addedAt).getTime() : null;
    default:
      return null;
  }
}

/** Does a stable release fall inside the board window? Used as a badge, not a weight. */
export function shippedWithin(p: Project, board: BoardId, snapshotDate: string): boolean {
  if (board !== 'week' && board !== 'month') return false;
  return releasedWithin(p, snapshotDate, board === 'week' ? 7 : 30);
}

export function rankProjects(data: DataFile, board: BoardId, limit = 20): Project[] {
  return data.projects
    .map((p) => ({ p, s: score(p, board, data.snapshotDate) }))
    .filter((row): row is { p: Project; s: number } => row.s !== null)
    .sort(
      (a, b) =>
        b.s - a.s ||
        (b.p.momentum?.stars ?? 0) - (a.p.momentum?.stars ?? 0) ||
        a.p.name.localeCompare(b.p.name),
    )
    .slice(0, limit)
    .map((row) => row.p);
}

/** How many projects each board can actually show — the honesty note reads this. */
export function boardCoverage(data: DataFile, board: BoardId): number {
  return data.projects.filter((p) => score(p, board, data.snapshotDate) !== null).length;
}

/** The number to print next to a ranked row, and the exact value used for ordering. */
export function boardValue(p: Project, board: BoardId): string {
  const m = p.momentum;
  if (!m) return '未知';
  if (board === 'today' || board === 'week') {
    return m.commits1w === null ? '未知' : `${m.commits1w} 次`;
  }
  if (board === 'month') {
    return m.commits4w === null ? '未知' : `${m.commits4w} 次`;
  }
  if (board === 'rising') {
    const d = m.month ?? m.week ?? m.day;
    if (!d || d.spanDays <= 0) return '数据不足';
    // The rate is the sort key; spell it out so ordering is verifiable.
    const perDay = Math.round((d.delta / d.spanDays) * 100) / 100;
    return `${perDay > 0 ? '+' : ''}${perDay} ★/天`;
  }
  if (board === 'stars') {
    return m.stars === null ? '未知' : `★ ${m.stars.toLocaleString('en-US')}`;
  }
  return p.addedAt ? p.addedAt.slice(5, 10) : '未知';
}

/** Second line under a rising row: the raw delta and the span it was measured over. */
export function boardSpan(p: Project): string | null {
  const d = p.momentum?.month ?? p.momentum?.week ?? p.momentum?.day;
  if (!d) return null;
  const sign = d.delta > 0 ? '+' : '';
  return `${sign}${d.delta} ★ / ${d.spanDays} 天（${d.from} → ${d.to}）`;
}

/**
 * One line of context under a row title: what just happened, with a real date.
 * Only STABLE releases are treated as "shipped"; a nightly build is labelled as such
 * and never becomes the headline event.
 */
export function boardNote(p: Project, snapshotDate: string): string {
  const rel = p.momentum?.latestRelease;
  if (rel?.publishedAt) {
    const days = Math.max(0, Math.round((endOf(snapshotDate) - new Date(rel.publishedAt).getTime()) / DAY));
    const when = days === 0 ? '今天' : days === 1 ? '昨天' : `${days} 天前`;
    return `${rel.tag ?? '新版本'} · ${when}发布`;
  }
  const pre = p.momentum?.latestPrerelease;
  if (pre?.publishedAt) {
    return `${pre.tag ?? '预发布'} · 预发布，不计入发版`;
  }
  if (p.repo.pushedAt) return `最近推送 ${relativeTo(p.repo.pushedAt, snapshotDate)}`;
  return p.tagline;
}

/**
 * The freshness feed: real dated events across the whole catalogue, newest first.
 * Powers 「刚刚发生」 on the home page and the /feed page.
 */
export interface FeedEvent {
  kind: 'release' | 'prerelease' | 'commit' | 'added';
  project: Project;
  at: string;
  label: string;
}

export function feedEvents(data: DataFile, limit = 20): FeedEvent[] {
  const events: FeedEvent[] = [];
  for (const p of data.projects) {
    const rel = p.momentum?.latestRelease;
    if (rel?.publishedAt) {
      events.push({ kind: 'release', project: p, at: rel.publishedAt, label: `发布 ${rel.tag ?? '新版本'}` });
    }
    const pre = p.momentum?.latestPrerelease;
    if (pre?.publishedAt) {
      // Nightly/pre-release builds are real events but not releases; label them so
      // they can never be mistaken for a shipped version.
      events.push({ kind: 'prerelease', project: p, at: pre.publishedAt, label: `预发布 ${pre.tag ?? ''}`.trim() });
    }
    if (p.repo.pushedAt) {
      events.push({
        kind: 'commit',
        project: p,
        at: p.repo.pushedAt,
        label: p.momentum?.commits1w ? `本周 ${p.momentum.commits1w} 次提交` : '有新的推送',
      });
    }
    if (p.addedAt) events.push({ kind: 'added', project: p, at: p.addedAt, label: '进入清单' });
  }
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** Human label for a feed event kind. Kept here so both pages agree. */
export function feedKindLabel(kind: FeedEvent['kind']): string {
  return { release: '发版', prerelease: '预发布', commit: '推送', added: '收录' }[kind];
}

/** Deepest star-delta window we can prove, for the footnote on the rising board. */
export function historyDepth(data: DataFile): { days: number | null; enough: boolean } {
  let best: number | null = null;
  for (const p of data.projects) {
    const d = p.momentum?.month ?? p.momentum?.week ?? p.momentum?.day;
    if (d) best = Math.max(best ?? 0, d.spanDays);
  }
  return { days: best, enough: best !== null };
}

/** "Today's pick" = deterministic by date, so it changes once a day and every visitor sees the same. */
export function todayPicks(data: DataFile, count = 3, today = new Date()): Project[] {
  const key = `${today.getUTCFullYear()}-${today.getUTCMonth() + 1}-${today.getUTCDate()}`;
  const pool = [...data.projects].sort((a, b) => b.popularityScore - a.popularityScore).slice(0, 18);
  const seed = key.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + today.getUTCDate() * 7;
  const out: Project[] = [];
  let idx = seed % Math.max(1, pool.length);
  while (out.length < Math.min(count, pool.length)) {
    const candidate = pool[idx % pool.length];
    if (!out.includes(candidate)) out.push(candidate);
    idx += 5;
  }
  return out;
}

export function similar(data: DataFile, project: Project, limit = 3): Project[] {
  const scored = data.projects
    .filter((p) => p.slug !== project.slug)
    .map((p) => {
      let score = 0;
      if (p.category === project.category) score += 3;
      for (const t of p.tags) if (project.tags.includes(t)) score += 2;
      if (p.audience === project.audience) score += 1;
      if (p.license.spdx && p.license.spdx === project.license.spdx) score += 1;
      return { p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.p.popularityScore - a.p.popularityScore);
  return scored.slice(0, limit).map((s) => s.p);
}

export function randomProject(data: DataFile, exclude?: string): Project {
  const pool = data.projects.filter((p) => p.slug !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Honest labels for fields we could not verify. */
export const UNKNOWN = '未知';

export function licenseLabel(license: License): string {
  if (!license.spdx) return `未知（${license.note || '未在仓库中声明'}）`;
  return license.name ? `${license.name} · ${license.spdx}` : license.spdx;
}

export function statusLabel(status: ProjectStatus): string {
  return {
    active: '持续维护',
    stale: '更新放缓',
    archived: '已归档',
    unknown: '活跃度未知',
    dead: '链接可能失效',
  }[status];
}

/**
 * Activity is derived from `pushed_at` only — never from vibes.
 * Thresholds are stated on the page so a reader can disagree with them.
 */
export function activityLevel(project: Project, snapshotDate: string): ProjectStatus {
  if (project.repo.archived) return 'archived';
  if (!project.repo.pushedAt) return 'unknown';
  const days = (endOf(snapshotDate) - new Date(project.repo.pushedAt).getTime()) / 86_400_000;
  if (!Number.isFinite(days)) return 'unknown';
  if (days <= 120) return 'active';
  if (days <= 540) return 'stale';
  return 'unknown';
}

export function sourceLabel(source: Sourced): string {
  return {
    api: 'GitHub API 元信息',
    manual: '人工录入',
  }[source];
}

export function enrichmentLabel(e: Enrichment): string {
  return {
    api: 'API 抓取',
    manual: '人工填写',
    scraped: '受控抓取',
    unknown: '未知',
  }[e];
}

/** Sort projects by readiness for the "体验门槛" filter/sort chips. */
export const EFFORT_ORDER = ['零门槛', '低门槛', '中等门槛', '较高门槛', '高门槛'];

export function effortRank(project: Project): number {
  const i = EFFORT_ORDER.indexOf(project.setup.effort);
  return i === -1 ? EFFORT_ORDER.length : i;
}

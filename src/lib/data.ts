import type { Category, Enrichment, License, Project, ProjectStatus, Sourced } from '../data/types';

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

export async function loadData(): Promise<DataFile> {
  if (cache) return cache;
  const res = await fetch(`${import.meta.env.BASE_URL}data/projects.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`无法加载项目数据（HTTP ${res.status}）`);
  cache = (await res.json()) as DataFile;
  return cache;
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
  const days = (new Date(snapshotDate).getTime() - new Date(project.repo.pushedAt).getTime()) / 86_400_000;
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

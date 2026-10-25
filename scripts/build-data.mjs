/**
 * Compose the published dataset.
 *
 *   data/projects/*.json   editorial copy, hand-written and reviewed
 *   data/repo/*.json       machine snapshot from GitHub (stars, license, pushed_at, README digest)
 *   public/shots/*.webp    real screenshots captured from official sites
 *            ↓  npm run data:build
 *   public/data/projects.json  what the site (and the browser) actually loads
 *
 * Keeping the merge here means stars/README can be refreshed by `data:update`
 * without ever touching the Chinese copy, and the copy can be edited without
 * accidentally rewriting machine facts.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS, loadProjects, readJson, writeJson } from './lib/fs.mjs';

const categories = readJson(PATHS.categories, { categories: [] }).categories;
const categoryIds = new Set(categories.map((c) => c.id));
const manifest = readJson(join(PATHS.root, 'public', 'shots', 'manifest.json'), {}) ?? {};

const now = new Date();
const today = now.toISOString().slice(0, 10);

function fail(msg) {
  throw new Error(`[data:build] ${msg}`);
}

const seenSlug = new Map();
const seenRepo = new Map();
const seenName = new Map();

const projects = [];
const drafts = [];

for (const { file, project: editorial } of loadProjects()) {
  const rel = file.split(/[\\/]/).slice(-2).join('/');

  // Drafts (created by `data:import`) are reviewable but never published.
  if (editorial.review?.status === 'draft') {
    drafts.push(editorial.slug);
    continue;
  }

  const repoSnapFile = join(PATHS.root, 'data', 'repo', `${editorial.slug}.json`);
  if (!existsSync(repoSnapFile)) fail(`${rel}: 缺少 data/repo/${editorial.slug}.json，请先运行 npm run data:fetch`);

  const snap = readJson(repoSnapFile);
  const gh = snap.github;
  if (!gh) fail(`${rel}: 仓库快照缺少 github 字段`);

  if (!categoryIds.has(editorial.category)) fail(`${rel}: 分类 ${editorial.category} 不在 categories.json 中`);

  // ---- duplicate detection -------------------------------------------------
  const repoKey = (gh.fullName || '').toLowerCase();
  const nameKey = editorial.name.trim().toLowerCase();
  if (seenSlug.has(editorial.slug)) fail(`重复 slug: ${editorial.slug}`);
  if (repoKey && seenRepo.has(repoKey)) fail(`重复仓库: ${gh.fullName}（${seenRepo.get(repoKey)} 与 ${editorial.slug}）`);
  if (seenName.has(nameKey)) fail(`重复项目名: ${editorial.name}`);
  seenSlug.set(editorial.slug, rel);
  if (repoKey) seenRepo.set(repoKey, editorial.slug);
  seenName.set(nameKey, editorial.slug);

  // ---- license ---------------------------------------------------------------
  // GitHub's detector misses custom licenses (Open WebUI, LobeHub, ESPHome,
  // MetaMask). The editorial file may override, but only with a note + source.
  let license = gh.license;
  if (editorial.licenseOverride) {
    const o = editorial.licenseOverride;
    if (!o.note) fail(`${rel}: licenseOverride 必须写明 note（为什么不采用 GitHub 的识别结果）`);
    license = { spdx: o.spdx ?? null, name: o.name ?? null, note: o.note, url: o.url ?? null };
  }

  // ---- screenshots -----------------------------------------------------------
  const shot = manifest[editorial.slug];
  const screenshots = [];
  if (shot && shot.src && !shot.error) {
    const isRepoPage = shot.origin === 'og';
    screenshots.push({
      src: shot.src,
      card: shot.card,
      alt: isRepoPage ? `${editorial.name} 的 GitHub 仓库页面截图` : `${editorial.name} 的官方站点截图`,
      origin: shot.origin || 'live',
      capturedAt: shot.capturedAt || null,
      credit: `${isRepoPage ? '仓库页面截图' : '页面截图'}：${shot.captureUrl}`,
      synthetic: false,
    });
  }

  if (editorial.features.length < 3) fail(`${rel}: 至少 3 条主要功能`);

  const readmeChars = snap.readme?.chars ?? 0;
  if (!readmeChars) {
    // Not fatal: a project may legitimately have no README. But then the copy must say so.
    if (!/未读取|无 README/i.test(editorial.contentBasis)) {
      fail(`${rel}: 未读取到 README，contentBasis 必须明确说明`);
    }
  }

  // Ranking signals are DERIVED, never invented: stars (log scale) + how recently the
  // repo was pushed. There is no analytics backend, so "本周热门" is explicitly a
  // GitHub-metrics list and the UI says so.
  const stars = typeof gh.stars === 'number' ? gh.stars : 0;
  const daysSincePush = gh.pushedAt ? Math.max(0, (now.getTime() - new Date(gh.pushedAt).getTime()) / 86_400_000) : 9999;
  const popularityScore = Math.round(Math.log10(stars + 1) * 100);
  const weeklyScore = popularityScore + (daysSincePush <= 7 ? 120 : daysSincePush <= 30 ? 60 : daysSincePush <= 90 ? 20 : 0);

  const published = {
    ...editorial,
    popularityScore,
    weeklyScore,
    categoryName: categories.find((c) => c.id === editorial.category)?.name,
    license,
    repo: {
      owner: gh.owner,
      name: gh.name,
      fullName: gh.fullName,
      url: gh.url,
      homepage: gh.homepage,
      description: gh.description,
      stars: gh.stars,
      forks: gh.forks,
      openIssues: gh.openIssues,
      language: gh.language,
      topics: gh.topics ?? [],
      license,
      createdAt: gh.createdAt,
      pushedAt: gh.pushedAt,
      archived: gh.archived,
      fetchedAt: gh.fetchedAt,
      source: gh.source,
      warnings: gh.warnings ?? [],
    },
    officialUrl: editorial.officialUrl ?? gh.homepage ?? null,
    demoUrl: editorial.demoUrl ?? null,
    linkStatus: editorial.linkStatus ?? 'unchecked',
    linkCheckedAt: editorial.linkCheckedAt ?? null,
    screenshots,
    readme: {
      path: snap.readme?.path ?? null,
      excerpt: snap.readme?.excerpt ?? null,
      headings: snap.readme?.headings ?? [],
      chars: readmeChars,
      fetchedAt: gh.fetchedAt,
      truncated: Boolean(snap.readme?.truncated),
    },
    review: {
      ...editorial.review,
      status: editorial.review?.status ?? 'published',
    },
    updatedAt: editorial.review?.reviewedAt ?? editorial.addedAt,
  };
  projects.push(published);
}

// Stable display order: featured first, then by popularity score.
projects.sort((a, b) => Number(b.featured) - Number(a.featured) || b.popularityScore - a.popularityScore || a.name.localeCompare(b.name));

const data = {
  generatedAt: now.toISOString(),
  snapshotDate: today,
  counts: { projects: projects.length, categories: categories.length },
  categories,
  seed: [17, 42, 93],
  projects,
};

writeJson(join(PATHS.publicData, 'projects.json'), data);
console.log(`[data:build] ${projects.length} 个项目 → public/data/projects.json`);
if (drafts.length) console.log(`[data:build] 跳过 ${drafts.length} 个草稿（review.status=draft）：${drafts.join(', ')}`);
console.log(
  `[data:build] 有截图 ${projects.filter((p) => p.screenshots.length).length}/${projects.length}；` +
    `许可证已确认 ${projects.filter((p) => p.license.spdx).length}/${projects.length}；` +
    `分类覆盖 ${new Set(projects.map((p) => p.category)).size}/${categories.length}`,
);

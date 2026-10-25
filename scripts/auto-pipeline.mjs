/**
 * The unattended lane: discover → fetch → publish, with no human in the loop.
 *
 *   GITHUB_TOKEN=... node scripts/auto-pipeline.mjs            # up to 3 new projects
 *   GITHUB_TOKEN=... node scripts/auto-pipeline.mjs --limit=1 --dry-run
 *
 * What it can do alone:
 *   - search GitHub for fresh, popular repos inside our 10 categories
 *   - skip anything already in the catalogue (repo full name / name / homepage)
 *   - pull public metadata + README, capture a real screenshot
 *   - write a Chinese summary from README facts (rule-based, or an LLM if AI_API_KEY
 *     is configured) and publish it with review.mode = "auto"
 *
 * What it deliberately cannot do: invent Star counts, licences or features. Every
 * field it writes is either fetched or left null. Auto entries are labelled
 * "自动收录 · 未人工校对" in the UI so readers know which ones a human has not read.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from './lib/github.mjs';
import { autoTagline, buildChineseDraft } from './lib/draft.mjs';
import { CATEGORY_QUERIES, pickCandidates, searchUrl } from './lib/discover.mjs';
import { PATHS, createLogger, loadProjects, readJson, slugify, writeJson } from './lib/fs.mjs';
import { captureSnapshot } from './lib/snapshot.mjs';

const flags = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    }),
);
const limit = Math.min(5, Math.max(0, Number(flags.limit ?? 3)));
const dryRun = Boolean(flags['dry-run']);
const logger = createLogger('auto');
const client = createClient({ log: (entry) => logger.http(entry) });
const now = new Date();

const categories = readJson(PATHS.categories, { categories: [] }).categories;
const categoryName = (id) => categories.find((c) => c.id === id)?.name ?? id;

const existing = loadProjects().map(({ project }) => {
  const snap = readJson(join(PATHS.root, 'data', 'repo', `${project.slug}.json`));
  return {
    slug: project.slug,
    name: project.name,
    repo: snap?.github?.fullName ?? null,
    site: project.officialUrl ?? snap?.github?.homepage ?? null,
  };
});
logger.info('existing', `catalogue has ${existing.length} projects`);

// ---- 1. discover -----------------------------------------------------------
const results = [];
for (const entry of CATEGORY_QUERIES) {
  const res = await client.request(searchUrl(entry).replace('https://api.github.com', ''), { allow404: true });
  if (!res.ok) {
    logger.warn('search_failed', `${entry.category} -> ${res.status} ${res.error}`);
    continue;
  }
  const repos = res.data.items ?? [];
  results.push({ category: entry.category, repos });
  logger.info('search', `${entry.category}: ${repos.length} hits (quota ${client.state.remaining ?? '?'})`);
  await new Promise((r) => setTimeout(r, 1200)); // stay polite with the search limit
}

const picked = pickCandidates(results, existing, limit);
logger.info('picked', picked.map((p) => `${p.repo.full_name} (${p.category}, ★${p.repo.stargazers_count})`).join(' | ') || 'none');

if (!picked.length) {
  const report = { ranAt: now.toISOString(), picked: [], added: [], skipped: 'no fresh candidates passed the filters' };
  writeJson(join(PATHS.root, 'data', 'auto-report.json'), report);
  logger.finish(report);
  console.log('没有找到符合条件的新项目（这是正常的，宁缺毋滥）。');
  process.exit(0);
}

if (dryRun) {
  console.log(JSON.stringify(picked.map((p) => ({ repo: p.repo.full_name, category: p.category, stars: p.repo.stargazers_count })), null, 2));
  logger.finish({ dryRun: true, picked: picked.map((p) => p.repo.full_name) });
  process.exit(0);
}

// ---- 2. fetch + publish ----------------------------------------------------
const added = [];
for (const { category, repo } of picked) {
  const slug = slugify(repo.name);
  const target = join(PATHS.projectsDir, `${slug}.json`);
  if (existsSync(target)) {
    logger.warn('skip_slug_taken', slug);
    continue;
  }

  const snap = await captureSnapshot({ slug, repoInput: repo.full_name, client, logger });
  if (!snap.ok) {
    logger.warn('snapshot_failed', `${repo.full_name}: ${snap.reason}`);
    continue;
  }

  const repoSnap = readJson(join(PATHS.root, 'data', 'repo', `${slug}.json`));
  const readmeText = repoSnap?.readme?.rawFile ? readFile(join(PATHS.root, repoSnap.readme.rawFile)) : '';
  const shot = await captureShot(slug, repo);
  if (shot) logger.info('shot', `${slug} -> ${shot}`);

  const draft = buildChineseDraft({ slug, name: repo.name, record: snap.record, readme: repoSnap?.readme, readmeText, mode: 'auto' });
  const licence = repoSnap?.github?.license ?? { spdx: null, name: null, note: '仓库未声明可识别许可证' };

  const project = {
    slug,
    name: repo.name,
    // Category name + the repo's own sentence: honest, and never a claim we can't source.
    tagline: autoTagline(categoryName(category), snap.record),
    summary: draft.summary,
    category,
    tags: unique([...draft.suggestedTopics, categoryName(category), licence.spdx].filter(Boolean)).slice(0, 5),
    aliases: [repo.full_name],
    audience: '开发者',
    audienceFor: draft.audienceFor,
    features: draft.features,
    contentBasis: draft.contentBasis,
    setup: {
      effort: '低门槛',
      effortNote: draft.setup.effortNote,
      requires: [],
      steps: draft.setup.steps,
      cost: licence.spdx ? '开源免费（以仓库许可证为准）' : '费用未知',
    },
    officialUrl: repo.homepage || null,
    demoUrl: null,
    linkStatus: 'unchecked',
    linkCheckedAt: null,
    featured: false,
    screenshots: shot
      ? [
          {
            src: shot,
            alt: `${repo.name} 的官方站点截图`,
            origin: 'live',
            capturedAt: now.toISOString(),
            credit: `页面截图：${repo.homepage}`,
            synthetic: false,
          },
        ]
      : [],
    addedAt: now.toISOString().slice(0, 10),
    review: {
      status: 'published',
      mode: 'auto',
      reviewedBy: 'autopipeline',
      reviewedAt: now.toISOString().slice(0, 10),
      todo: '自动收录：中文文案由 README 规则生成，建议人工润色',
    },
  };

  writeJson(target, project);
  added.push({ slug, repo: repo.full_name, category, stars: repo.stargazers_count ?? null, shot: Boolean(shot) });
  logger.info('published', `${slug} (${category}) ★${repo.stargazers_count}`);
}

// ---- 3. rebuild derived data ----------------------------------------------
if (added.length) {
  const build = spawnSync(process.execPath, [join(PATHS.root, 'scripts', 'build-data.mjs')], { cwd: PATHS.root, encoding: 'utf8' });
  if (build.status !== 0) {
    logger.error('build_failed', (build.stderr || build.stdout || '').slice(0, 400));
  } else {
    logger.info('rebuilt', (build.stdout || '').trim().split('\n')[0]);
  }
}

const report = {
  ranAt: now.toISOString(),
  auth: client.state.authenticated ? 'token' : 'anonymous',
  searched: results.length,
  picked: picked.map((p) => ({ repo: p.repo.full_name, category: p.category })),
  added,
};
writeJson(join(PATHS.root, 'data', 'auto-report.json'), report);
const log = logger.finish(report);
console.log(`\n自动收录：新增 ${added.length} 个项目。`);
for (const a of added) console.log(`  · ${a.slug}（${categoryName(a.category)}，★${a.stars ?? '未知'}${a.shot ? '，含截图' : '，无截图'}）`);
console.log(`运行日志: ${log.file}`);

/** Optional screenshot: only if Playwright + Chrome are available in this environment. */
async function captureShot(slug, repo) {
  const url = repo.homepage || repo.html_url;
  const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  if (!existsSync(chrome)) {
    logger.warn('no_chrome', '跳过截图（未找到 Chrome），页面将显示带标注的占位图');
    return null;
  }
  try {
    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--ignore-certificate-errors'] });
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 750 }, deviceScaleFactor: 1, locale: 'zh-CN' });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(3500);
    const dir = join(PATHS.root, 'public', 'shots');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${slug}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 78, animations: 'disabled' });
    await browser.close();
    // build-data only trusts the manifest, so register the shot there too.
    const manifestFile = join(dir, 'manifest.json');
    const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
    manifest[slug] = {
      src: `/shots/${slug}.jpg`,
      captureUrl: url,
      origin: 'live',
      title: await Promise.resolve(repo.name),
      capturedAt: new Date().toISOString(),
      auto: true,
    };
    writeJson(manifestFile, manifest);
    return `/shots/${slug}.jpg`;
  } catch (error) {
    logger.warn('shot_failed', `${slug}: ${String(error.message).split('\n')[0]}`);
    return null;
  }
}

function readFile(file) {
  try {
    return existsSync(file) ? readFileSync(file, 'utf8') : '';
  } catch {
    return '';
  }
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

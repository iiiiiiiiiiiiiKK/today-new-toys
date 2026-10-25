/**
 * Data quality gate. Runs in `npm run build` (so a bad record can never ship) and
 * standalone in CI.
 *
 *   npm run data:check
 *
 * What it enforces:
 *   - schema-ish shape (required fields, types, allowed enums)
 *   - every category referenced exists; every category has at least one project
 *   - unique slugs, unique repos, unique names (duplicate projects are rejected)
 *   - no fabricated numbers: stars/forks/issue counts are either null or a number
 *     that came from a snapshot, and every repo snapshot carries fetchedAt
 *   - Chinese copy exists and is not placeholder text
 *   - README was actually read when the copy claims features
 *   - all local screenshot files exist on disk
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS, loadProjects, readJson } from './lib/fs.mjs';

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const categories = readJson(PATHS.categories, { categories: [] }).categories;
const catIds = new Set(categories.map((c) => c.id));
const sources = readJson(PATHS.sources, { sources: [] }).sources;
const manifest = readJson(join(PATHS.root, 'public', 'shots', 'manifest.json'), {}) ?? {};

const rows = loadProjects();
const publishedRows = rows.filter(({ project }) => project.review?.status !== 'draft');
const draftRows = rows.filter(({ project }) => project.review?.status === 'draft');
if (publishedRows.length === 0) err('data/projects 下没有任何已发布项目');

const slugs = new Set();
const repos = new Map();
const names = new Map();
const usedCategories = new Set();

const REQUIRED = ['slug', 'name', 'tagline', 'summary', 'category', 'tags', 'audience', 'audienceFor', 'features', 'contentBasis', 'setup'];
const EFFORT = ['零门槛', '低门槛', '中等门槛', '较高门槛', '高门槛'];

for (const { file, project } of publishedRows) {
  const rel = file.split(/[\\/]/).slice(-2).join('/');
  for (const key of REQUIRED) {
    if (project[key] === undefined || project[key] === null || project[key] === '') err(`${rel}: 缺少字段 ${key}`);
  }
  if (project.slug && !/^[a-z0-9-]+$/.test(project.slug)) err(`${rel}: slug 只能是小写字母、数字和连字符`);
  if (slugs.has(project.slug)) err(`重复 slug: ${project.slug}`);
  slugs.add(project.slug);

  if (!catIds.has(project.category)) err(`${rel}: 分类不存在 ${project.category}`);
  usedCategories.add(project.category);

  if (!Array.isArray(project.tags) || project.tags.length < 2) err(`${rel}: 至少需要 2 个标签`);
  if (!Array.isArray(project.features) || project.features.length < 3) err(`${rel}: 至少需要 3 条主要功能`);
  if (!Array.isArray(project.audienceFor) || project.audienceFor.length < 2) err(`${rel}: 至少需要 2 条适用人群`);
  if (!EFFORT.includes(project.setup?.effort)) err(`${rel}: setup.effort 必须是 ${EFFORT.join(' / ')} 之一`);
  if (!Array.isArray(project.setup?.steps) || project.setup.steps.length < 1) err(`${rel}: 至少需要 1 个使用步骤`);

  // Scan only reader-facing copy: `review.todo` is a legitimate field name, not lorem text.
  const copy = [project.tagline, project.summary, project.contentBasis, project.editorsNote ?? '', ...(project.audienceFor ?? []), ...(project.features ?? []).flatMap((f) => [f.title, f.detail])].join(' ');
  if (/lorem ipsum|待补充|此处填写|placeholder text/i.test(copy)) err(`${rel}: 正文包含占位文本`);
  if (project.tagline && project.tagline.length > 40) warn(`${rel}: 一句话介绍超过 40 字`);

  const repoFile = join(PATHS.root, 'data', 'repo', `${project.slug}.json`);
  if (!existsSync(repoFile)) {
    err(`${rel}: 缺少仓库快照 data/repo/${project.slug}.json`);
    continue;
  }
  const snap = readJson(repoFile);
  const gh = snap.github;
  if (!gh) {
    err(`${rel}: 仓库快照缺少 github`);
    continue;
  }
  const key = (gh.fullName || '').toLowerCase();
  if (!key) err(`${rel}: 仓库快照缺少 fullName`);
  else if (repos.has(key)) err(`重复仓库 ${gh.fullName}: ${repos.get(key)} 与 ${project.slug}`);
  else repos.set(key, project.slug);

  const nk = String(project.name).trim().toLowerCase();
  if (names.has(nk)) err(`重复项目名 ${project.name}: ${names.get(nk)} 与 ${project.slug}`);
  names.set(nk, project.slug);

  if (!gh.fetchedAt) err(`${rel}: 快照缺少 fetchedAt`);
  for (const f of ['stars', 'forks', 'openIssues']) {
    const v = gh[f];
    if (v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0)) err(`${rel}: ${f} 必须是 null 或非负数字`);
  }
  if (gh.stars === null) warn(`${rel}: Star 数未知，页面会显示「未知」`);
  if (!snap.readme || !snap.readme.chars) {
    if (!/未读取|无 README/i.test(project.contentBasis || '')) err(`${rel}: README 未读取，但 contentBasis 没有说明`);
    warn(`${rel}: 未读取 README`);
  } else if (project.contentBasis && !/(README|README\.md|仓库)/.test(project.contentBasis)) {
    warn(`${rel}: contentBasis 未提及 README，请确认摘要依据`);
  }

  if (!project.officialUrl && !gh.homepage) warn(`${rel}: 没有官网地址，详情页只展示仓库链接`);
  if (!project.review || !['published', 'draft', 'needs-review'].includes(project.review.status)) {
    err(`${rel}: review.status 非法`);
  }
  if (project.review?.status === 'published' && !project.review.reviewedBy) {
    err(`${rel}: 已发布项目必须记录 reviewedBy`);
  }

  const shot = manifest[project.slug];
  if (shot?.src) {
    const p = join(PATHS.root, 'public', shot.src.replace(/^\//, ''));
    if (!existsSync(p)) err(`${rel}: 截图文件不存在 ${shot.src}`);
  }
}

// category coverage
for (const c of categories) {
  if (!usedCategories.has(c.id)) err(`分类 ${c.id}（${c.name}）没有任何项目`);
}

// sources should map 1:1 to project files (so an import can't silently be forgotten)
for (const s of sources) {
  if (!slugs.has(s.slug)) warn(`data/sources.json 中的 ${s.slug} 还没有对应的项目文件`);
}

if (publishedRows.length < 20) warn(`已发布项目数量偏少（${publishedRows.length}），首页各栏目可能重复`);
for (const { project } of draftRows) warn(`草稿未发布：${project.slug}（${project.review?.todo ?? '待补全'}）`);

console.log(`检查了 ${publishedRows.length} 个已发布项目 / ${categories.length} 个分类${draftRows.length ? `（另有 ${draftRows.length} 个草稿跳过）` : ''}`);
if (warnings.length) {
  console.log(`\n${warnings.length} 条提醒：`);
  for (const w of warnings) console.log(`  · ${w}`);
}
if (errors.length) {
  console.error(`\n${errors.length} 个错误：`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log('\n数据检查通过。');

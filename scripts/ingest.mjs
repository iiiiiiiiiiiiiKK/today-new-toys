/**
 * Content pipeline entry point.
 *
 *   node scripts/ingest.mjs import https://github.com/owner/repo [--category ai-tools]
 *   node scripts/ingest.mjs update [slug...]
 *   node scripts/ingest.mjs verify
 *
 * import  — creates a DRAFT project file from a repository URL, so a failed import
 *           never blocks manual adding: the draft opens with fields prefilled and
 *           `review.status = "draft"` (the build refuses to publish drafts).
 * update  — refreshes stars/license/pushed_at/README snapshot for published projects.
 * verify  — checks every external link (official site + repo) and records status.
 *
 * Everything logs to data/logs/*.jsonl. Nothing here is a secret except GITHUB_TOKEN,
 * which is read from the environment and never written anywhere.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, parseRepoInput } from './lib/github.mjs';
import { scrapeRepoPage } from './lib/scrape.mjs';
import { buildChineseDraft } from './lib/draft.mjs';
import { PATHS, createLogger, loadProjects, readJson, slugify, writeJson } from './lib/fs.mjs';
import { captureSnapshot } from './lib/snapshot.mjs';

const [command, ...rest] = process.argv.slice(2);
const positional = rest.filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(
  rest
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    }),
);
const logger = createLogger(`ingest-${command || 'none'}`);
const client = createClient({ log: (entry) => logger.http(entry) });

const categories = readJson(PATHS.categories, { categories: [] }).categories;

function readFileSafe(file) {
  try {
    return existsSync(file) ? readFileSync(file, 'utf8') : '';
  } catch {
    return '';
  }
}

/**
 * Optional LLM drafting. Requires AI_BASE_URL + AI_API_KEY + AI_MODEL in the
 * maintainer's environment; with `--ai` the script makes ONE request and still writes
 * a draft for human review. No key ever reaches the browser or the data files.
 */
async function aiDraft({ name, record, readmeText }) {
  const base = process.env.AI_BASE_URL;
  const key = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!base || !key || !model) throw new Error('缺少 AI_BASE_URL / AI_API_KEY / AI_MODEL');
  if (!readmeText) throw new Error('没有 README 原文，拒绝让模型凭空写');

  const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            '你是中文技术编辑。只允许依据用户提供的 README 原文写摘要，禁止推测未出现的功能、禁止编造 Star、评分或作者。输出 JSON：{"tagline","summary","features":[{"title","detail"}],"audienceFor":[],"setup":{"effort","effortNote","requires":[],"steps":[{"title","detail"}],"cost"},"contentBasis"}。summary 用 2-4 句中文；features 3-5 条且每条都能在 README 找到依据；contentBasis 写明依据 README 的哪些章节。',
        },
        { role: 'user', content: `项目名：${name}\n仓库描述：${record?.description || '（无）'}\nREADME 原文（截断）：\n${readmeText.slice(0, 12000)}` },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`AI 接口返回 ${res.status}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error('AI 返回为空');
  const parsed = JSON.parse(text);
  if (!parsed.summary || !Array.isArray(parsed.features)) throw new Error('AI 返回结构不完整');
  return {
    ...parsed,
    summary: `（AI 草稿，待人工核校）${parsed.summary}`,
    contentBasis: `AI 草稿（模型 ${model}）：${parsed.contentBasis || '依据所给 README 片段'}；未人工核校，不得直接发布。`,
  };
}

function emptyDraft(slug, repoInput, category) {
  return {
    slug,
    name: '',
    tagline: '',
    summary: '',
    category: category || categories[0].id,
    tags: [],
    aliases: [],
    audience: '开发者',
    audienceFor: [''],
    features: [{ title: '', detail: '' }],
    contentBasis: '',
    setup: {
      effort: '低门槛',
      effortNote: '',
      requires: [],
      steps: [{ title: '', detail: '' }],
      cost: '',
    },
    officialUrl: null,
    demoUrl: null,
    linkStatus: 'unchecked',
    linkCheckedAt: null,
    featured: false,
    addedAt: new Date().toISOString().slice(0, 10),
    review: {
      status: 'draft',
      reviewedBy: null,
      reviewedAt: null,
      todo: `导入草稿：${repoInput}，请补全中文介绍并核对 README 后再发布`,
    },
  };
}

async function importRepo(input) {
  const parsed = parseRepoInput(input);
  if (!parsed) {
    logger.error('bad_repo', `无法识别仓库地址：${input}\n支持：owner/repo、https://github.com/owner/repo、git@github.com:owner/repo.git`);
    return 1;
  }
  const slug = slugify(parsed.repo);
  const target = join(PATHS.projectsDir, `${slug}.json`);
  if (existsSync(target)) {
    logger.error('duplicate', `已经存在 data/projects/${slug}.json（slug 重复）。如要更新元信息请运行：npm run data:update -- ${slug}`);
    return 1;
  }

  // Duplicate detection on the repo full name, not just the slug: the same project
  // can be imported under a different slug otherwise.
  const existing = loadProjects().find(({ project }) => {
    const snap = readJson(join(PATHS.root, 'data', 'repo', `${project.slug}.json`));
    return snap?.github?.fullName?.toLowerCase() === `${parsed.owner}/${parsed.repo}`.toLowerCase();
  });
  if (existing) {
    logger.error('duplicate', `该仓库已收录为 ${existing.project.slug}，本次导入已取消。`);
    return 1;
  }

  let result = await captureSnapshot({ slug, repoInput: `${parsed.owner}/${parsed.repo}`, client, logger });
  if (!result.ok) {
    logger.warn('api_failed', `GitHub API 失败（${result.reason}），改用网页兜底抓取`);
    const scraped = await scrapeRepoPage(parsed.owner, parsed.repo);
    if (!scraped.ok) {
      logger.error('import_failed', `无法读取仓库：${scraped.error}。请改用「手动添加」：复制 data/projects/_template.json 后填写。`);
      return 1;
    }
    const record = scraped.data;
    writeJson(join(PATHS.root, 'data', 'repo', `${slug}.json`), {
      slug,
      repoInput: `${parsed.owner}/${parsed.repo}`,
      fetchedAt: record.fetchedAt,
      github: record,
      defaultBranch: 'main',
      readme: { path: null, via: null, chars: 0, headings: [], excerpt: null, truncated: false, rawFile: null },
    });
    result = { ok: true, record };
  }

  const draft = emptyDraft(slug, `${parsed.owner}/${parsed.repo}`, flags.category);
  draft.name = result.record?.name || parsed.repo;
  draft.officialUrl = result.record?.homepage || null;
  draft.tags = (result.record?.topics || []).slice(0, 4);

  // Optional AI pass. The key is read from the maintainer's environment only; it is
  // never written to disk or shipped. Without it we fall back to a factual,
  // rule-based Chinese draft that is explicitly labelled as unreviewed.
  const repoSnap = readJson(join(PATHS.root, 'data', 'repo', `${slug}.json`));
  const readmeText = repoSnap?.readme?.rawFile ? readFileSafe(join(PATHS.root, repoSnap.readme.rawFile)) : '';
  let generated;
  let generator = 'rule-based';
  if (flags.ai) {
    try {
      generated = await aiDraft({ name: draft.name, record: result.record, readmeText });
      generator = `ai:${process.env.AI_MODEL || 'default'}`;
      logger.info('ai_draft', `使用 AI 生成中文草稿（${generator}）`);
    } catch (error) {
      logger.warn('ai_failed', `${error.message}，回退到规则草稿`);
    }
  }
  if (!generated) {
    generated = buildChineseDraft({
      slug,
      name: draft.name,
      record: result.record,
      readme: repoSnap?.readme,
      readmeText,
    });
  }

  draft.tagline = generated.tagline;
  draft.summary = generated.summary;
  draft.features = generated.features;
  draft.audienceFor = generated.audienceFor;
  draft.setup = { ...draft.setup, ...generated.setup };
  draft.contentBasis = generated.contentBasis;
  draft.review.todo = `导入草稿（${generator}）：${parsed.owner}/${parsed.repo}。请阅读 README 后改写 summary / features / audienceFor / setup，再把 status 改为 published`;
  writeJson(target, draft);

  logger.info('draft_created', `data/projects/${slug}.json（状态 draft，构建时不会发布；生成方式 ${generator}）`);
  console.log(`\n下一步：`);
  console.log(`  1. 打开 data/projects/${slug}.json，按 README 逐条改写 summary / features / audienceFor / setup`);
  console.log(`  2. 在 contentBasis 里写明实际依据（例：依据仓库 README.md（约 3200 字）整理）`);
  console.log(`  3. 把 review.status 改为 published，填 reviewedBy / reviewedAt`);
  console.log(`  4. npm run data:check && npm run build`);
  console.log(`\n提示：机器草稿里的每一句都能在 README 找到出处，但它不是成品。发布前必须由人重写。`);
  return 0;
}

async function updateAll(slugs) {
  const rows = loadProjects().filter(({ project }) => !slugs.length || slugs.includes(project.slug));
  const summary = { total: rows.length, ok: 0, failed: 0, readmeChanged: 0 };
  for (const { project } of rows) {
    const repoInput = readJson(join(PATHS.root, 'data', 'repo', `${project.slug}.json`))?.github?.fullName || project.repo?.fullName;
    if (!repoInput) {
      logger.warn('skip', `${project.slug}: 没有仓库地址`);
      summary.failed += 1;
      continue;
    }
    const previousChars = readJson(join(PATHS.root, 'data', 'repo', `${project.slug}.json`))?.readme?.chars ?? 0;
    const result = await captureSnapshot({ slug: project.slug, repoInput, client, logger });
    if (result.ok) {
      summary.ok += 1;
      if (result.readmeChars !== previousChars) summary.readmeChanged += 1;
    } else {
      summary.failed += 1;
      logger.warn('update_failed', `${project.slug}: ${result.reason}`);
    }
  }
  logger.finish(summary);
  console.log(`\n更新完成：${summary.ok}/${summary.total}；README 长度变化 ${summary.readmeChanged} 个。`);
  console.log(`注意：本次只更新了仓库快照。中文介绍不会自动改写——README 有变化的项目需要人工复核后运行 data:check。`);
  return summary.failed ? 1 : 0;
}

async function verifyLinks() {
  const rows = loadProjects();
  const summary = { total: 0, ok: 0, dead: 0, flaky: 0 };
  const results = [];
  for (const { project } of rows) {
    const targets = [project.officialUrl, project.repo?.url].filter(Boolean);
    const row = { slug: project.slug, checkedAt: new Date().toISOString(), links: [] };
    for (const url of targets) {
      summary.total += 1;
      let last = { status: 0, error: 'unknown' };
      let ok = false;
      // Two attempts: a single timeout on a CDN edge is not evidence of a dead link.
      for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 15000);
          const res = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; today-new-toys-linkcheck/1.0)' },
            signal: controller.signal,
          });
          clearTimeout(timer);
          ok = res.status < 400;
          last = { status: res.status, error: ok ? undefined : `HTTP ${res.status}` };
        } catch (error) {
          last = { status: 0, error: String(error?.cause?.code || error?.message || error) };
        }
        if (!ok) await new Promise((r) => setTimeout(r, 1200));
      }
      // 429 / 403 / network errors are commonly bot protection, not link rot.
      const ambiguous = !ok && (last.status === 0 || last.status === 403 || last.status === 429);
      row.links.push({ url, status: last.status, ok, ambiguous, error: last.error });
      if (ok) summary.ok += 1;
      else if (ambiguous) {
        summary.flaky += 1;
        logger.warn('unreachable', `${project.slug} ${url} -> ${last.status || last.error}（可能是反爬/网络，不自动标记失效）`);
      } else {
        summary.dead += 1;
        logger.warn('dead_link', `${project.slug} ${url} -> ${last.status}`);
      }
    }
    results.push(row);
  }
  writeJson(join(PATHS.root, 'data', 'link-report.json'), {
    generatedAt: new Date().toISOString(),
    summary,
    note: 'ok=可访问；ambiguous=超时/429/403，通常为反爬或网络波动，需人工在浏览器确认；dead=明确的 4xx/5xx。本脚本不会自动修改项目的 linkStatus。',
    results,
  });
  logger.finish(summary);
  console.log(`\n链接检查：${summary.ok} 正常 / ${summary.flaky} 无法确认 / ${summary.dead} 明确失效，报告写入 data/link-report.json`);
  console.log('页面上的「标记失效链接」是人工动作：在浏览器确认后，把项目的 linkStatus 改为 dead 并重新构建。');
  return 0;
}

async function main() {
  if (command === 'import') {
    if (!positional[0]) {
      console.error('用法：npm run data:import -- https://github.com/owner/repo');
      return 1;
    }
    return importRepo(positional[0]);
  }
  if (command === 'update') return updateAll(positional);
  if (command === 'verify') return verifyLinks();
  console.error('用法：node scripts/ingest.mjs <import|update|verify> [...]');
  return 1;
}

const code = await main();
const res = logger.finish({ command, code });
console.log(`运行日志: ${res.file}`);
process.exitCode = code;

/**
 * Step 1 of the content pipeline: fetch public GitHub metadata + README for every
 * repository in `data/sources.json` and store a reviewable snapshot in `data/repo/`.
 *
 *   GITHUB_TOKEN=... node scripts/fetch.mjs           # all
 *   GITHUB_TOKEN=... node scripts/fetch.mjs biome uv  # some
 *
 * This script never touches `data/projects/*.json` — the published, hand-edited copy.
 * It only produces *inputs* for a human editor, so imported facts and published
 * Chinese copy stay separable. Without a token GitHub allows 60 requests/hour.
 */
import { readJson } from './lib/fs.mjs';
import { PATHS, createLogger } from './lib/fs.mjs';
import { createClient, parseRepoInput } from './lib/github.mjs';
import { captureSnapshot } from './lib/snapshot.mjs';

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const sources = readJson(PATHS.sources, { sources: [] }).sources;
const logger = createLogger('fetch');
const client = createClient({ log: (entry) => logger.http(entry) });
const summary = { requested: 0, ok: 0, failed: 0 };

logger.info('auth', `GITHUB_TOKEN ${client.state.authenticated ? '已提供（不计入匿名 60 次额度）' : '未提供，使用匿名额度（60 次/小时）'}`);

for (const source of sources) {
  if (only.length && !only.includes(source.slug)) continue;
  summary.requested += 1;
  if (!parseRepoInput(source.repo)) {
    logger.error('bad_repo', `${source.slug}: ${source.repo}`);
    summary.failed += 1;
    continue;
  }
  const result = await captureSnapshot({ slug: source.slug, repoInput: source.repo, client, logger });
  if (result.ok) summary.ok += 1;
  else {
    summary.failed += 1;
    logger.warn('repo_failed', `${source.slug} (${source.repo}) -> ${result.reason}${result.keptPrevious ? '（已保留上一次快照）' : ''}`);
  }
}

const result = logger.finish(summary);
console.log(`\n运行日志: ${result.file}`);
console.log(`剩余匿名额度: ${client.state.remaining ?? '未知'}/${client.state.limit ?? '未知'}`);
if (summary.failed > 0) {
  console.log(`\n${summary.failed} 个仓库抓取失败。可稍后重跑（npm run data:fetch），或在没有 Token 时手动补录：npm run data:import -- <repo-url>`);
}
process.exitCode = summary.ok === 0 ? 1 : 0;

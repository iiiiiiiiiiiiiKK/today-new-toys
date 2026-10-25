/**
 * One repository → one reviewable snapshot file.
 * Shared by `data:fetch` (seed list) and `data:update` (everything already published).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { digestReadme, parseRepoInput, repoRecord } from './github.mjs';
import { PATHS, readJson, writeJson } from './fs.mjs';

export async function captureSnapshot({ slug, repoInput, client, logger }) {
  const parsed = parseRepoInput(repoInput);
  if (!parsed) return { ok: false, reason: `无法识别仓库地址: ${repoInput}` };

  const outFile = join(PATHS.root, 'data', 'repo', `${slug}.json`);
  const previous = readJson(outFile);

  const res = await client.repo(parsed.owner, parsed.repo);
  if (!res.ok) {
    if (previous) {
      previous.fetchError = `${res.status} ${res.error}`;
      writeJson(outFile, previous);
    }
    return { ok: false, reason: `${res.status} ${res.error}`, keptPrevious: Boolean(previous) };
  }

  const record = repoRecord(res.data);
  const branch = res.data.default_branch || 'main';
  const readme = await client.readme(parsed.owner, parsed.repo, branch);
  const digest = digestReadme(readme.text || '');
  if (!readme.ok) record.warnings.push('README 读取失败，摘要只能基于仓库元信息');
  if (!record.license.spdx) record.warnings.push('仓库未声明可识别的开源许可证');

  mkdirSync(join(PATHS.root, 'data', 'repo'), { recursive: true });
  writeJson(outFile, {
    slug,
    repoInput,
    fetchedAt: record.fetchedAt,
    github: record,
    defaultBranch: branch,
    readme: {
      path: readme.path,
      via: readme.via,
      chars: digest.chars,
      headings: digest.headings,
      excerpt: digest.excerpt,
      truncated: digest.truncated,
      rawFile: readme.ok ? `data/readme/${slug}.md` : null,
    },
  });

  if (readme.ok) {
    mkdirSync(join(PATHS.root, 'data', 'readme'), { recursive: true });
    writeFileSync(join(PATHS.root, 'data', 'readme', `${slug}.md`), String(readme.text).slice(0, 60000), 'utf8');
  }

  logger.info('saved', `${slug} ★${record.stars ?? '未知'} ${record.license.spdx ?? '无 SPDX 许可证'} README=${digest.chars} 字`);
  return { ok: true, record, readmeChars: digest.chars };
}

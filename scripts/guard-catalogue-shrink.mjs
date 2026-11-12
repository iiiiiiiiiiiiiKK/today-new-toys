/**
 * Catalogue shrink guard.
 *
 * Twice now a local push built its commit tree from the working copy alone and
 * silently deleted project files that only existed on the remote (the daily bot
 * commits straight to `main`). The site then reported a frozen, shrinking catalogue
 * while the bot kept "adding" projects that never appeared.
 *
 * This guard fails the build when the published catalogue shrinks. A deliberate
 * removal opts out by putting `[allow-shrink]` in the commit subject.
 *
 *   node scripts/guard-catalogue-shrink.mjs            # compares HEAD~1 → HEAD
 *   BASE_REF=origin/main node scripts/guard-catalogue-shrink.mjs
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const ALLOW_MARKER = '[allow-shrink]';
const BASE_REF = process.env.BASE_REF || 'HEAD~1';

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function countAtRef(ref) {
  try {
    const out = git(['ls-tree', '-r', '--name-only', ref, '--', 'data/projects']);
    return out.split('\n').filter((line) => line.endsWith('.json') && !line.includes('_template')).length;
  } catch {
    return null; // shallow clone / first commit — nothing to compare
  }
}

const current = readdirSync('data/projects').filter((f) => f.endsWith('.json') && !f.startsWith('_')).length;
const base = countAtRef(BASE_REF);

if (base === null) {
  console.log(`[shrink-guard] 无法读取 ${BASE_REF}，跳过（当前 ${current} 个项目）`);
  process.exit(0);
}

let subject = '';
try {
  subject = git(['log', '-1', '--pretty=%s']);
} catch {
  /* ignore */
}

console.log(`[shrink-guard] ${BASE_REF}: ${base} → 当前: ${current}`);

if (current < base && !subject.includes(ALLOW_MARKER)) {
  console.error(
    `\n✗ 收录数量从 ${base} 降到 ${current}（少了 ${base - current} 个）。\n` +
      `  常见原因：用本地工作副本整体覆盖远端 tree，把每日自动收录的项目删掉了。\n` +
      `  如果是误删，先运行 scripts/restore-lost-projects.mjs 恢复；\n` +
      `  如果确实要删除，请在提交标题里加上 ${ALLOW_MARKER}。`,
  );
  process.exit(1);
}

console.log('[shrink-guard] 通过');

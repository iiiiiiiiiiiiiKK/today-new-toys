/**
 * Post-build asset preparation (runs after prerender).
 *
 *   node scripts/postbuild.mjs
 *
 * - makes og:image / twitter:image absolute, per project, pointing at the generated
 *   1200×630 card (link previews do not resolve relative URLs)
 * - verifies each project page really carries its own canonical + OG image
 * - writes dist/build-manifest.json so a deploy can be checked at a glance
 * - fails loudly if the catalogue JSON is missing from dist (classic static-deploy bug)
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PATHS } from './lib/fs.mjs';
import { siteConfig } from './lib/site.mjs';

const dist = join(PATHS.root, 'dist');
const dataFile = join(dist, 'data', 'projects.json');
if (!existsSync(dataFile)) {
  console.error('✗ dist/data/projects.json 缺失：站点会在运行时 404，构建失败。');
  process.exit(1);
}

const data = JSON.parse(readFileSync(dataFile, 'utf8'));
const site = siteConfig();
let verified = 0;
let failures = 0;

for (const p of data.projects) {
  const page = join(dist, 'project', p.slug, 'index.html');
  if (!existsSync(page)) {
    console.error(`✗ 缺少预渲染页面：dist/project/${p.slug}/index.html`);
    process.exit(1);
  }
  const ogFile = existsSync(join(PATHS.root, 'public', 'og', `${p.slug}.png`)) ? `/og/${p.slug}.png` : '/og/default.png';
  const og = `${site.siteRoot}${ogFile}`;
  let html = readFileSync(page, 'utf8');
  const next = html
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${og}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${og}$2`);
  if (next !== html) writeFileSync(page, next, 'utf8');

  const okOg = next.includes(`property="og:image" content="${og}"`);
  const okCanonical = next.includes(`rel="canonical" href="${site.url(`/project/${p.slug}`)}"`);
  if (okOg && okCanonical) verified += 1;
  else {
    failures += 1;
    console.error(`✗ ${p.slug}: OG 或 canonical 不正确`);
  }
}

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(p) : statSync(p).size;
  }
  return total;
}

const manifest = {
  builtAt: new Date().toISOString(),
  siteRoot: site.siteRoot,
  base: site.base,
  projects: data.projects.length,
  categories: data.categories.length,
  screenshotProjects: data.projects.filter((p) => p.screenshots.length).length,
  licenseConfirmed: data.projects.filter((p) => p.license.spdx).length,
  routes: 5 + data.categories.length + data.projects.length,
  ogCanonicalVerified: verified,
  sizeMB: +(dirSize(dist) / 1024 / 1024).toFixed(2),
};
writeFileSync(join(dist, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`[postbuild] ${manifest.projects} 个项目 / ${manifest.categories} 个分类 / ${manifest.routes} 个静态路由`);
console.log(`[postbuild] 截图 ${manifest.screenshotProjects}/${manifest.projects}，许可证已确认 ${manifest.licenseConfirmed}/${manifest.projects}`);
console.log(`[postbuild] OG 图与 canonical 校验 ${manifest.ogCanonicalVerified}/${manifest.projects}；dist ${manifest.sizeMB} MB`);
console.log(`[postbuild] 部署地址 ${site.siteRoot}（base ${site.base}）`);
if (failures) process.exit(1);

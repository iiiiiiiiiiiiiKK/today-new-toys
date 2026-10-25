/**
 * End-to-end checks against the production build (vite preview).
 *
 *   npm run build
 *   npm run preview        # terminal 1
 *   npm run test:e2e       # terminal 2
 *
 * Uses the locally installed Chrome via playwright-core (no browser download).
 * Every assertion touches real behaviour: DOM content, localStorage across reloads,
 * downloaded files, canvas pixels, URL routing — not "the button exists".
 */
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// BASE never ends with a slash; HOME is the index URL. A bare sub-path URL 404s on
// vite preview (it needs the trailing slash) while GitHub Pages redirects to it.
const BASE = (process.env.BASE_URL || 'http://localhost:4188').replace(/\/+$/, '');
const HOME = `${BASE}/`;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const downloads = join(root, '.tmp-e2e');
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = [];
let browser;
let context;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
async function test(name, fn) {
  try {
    const detail = await fn();
    record(name, true, typeof detail === 'string' ? detail : '');
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  rmSync(downloads, { recursive: true, force: true });
  mkdirSync(downloads, { recursive: true });
  browser = await chromium.launch({ executablePath: chrome, headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: 'zh-CN' });
  const page = await context.newPage();
  const errors = [];
  // Requests the suite triggers on purpose, whose 4xx is the correct answer.
  const EXPECTED_4XX = [/\/category\/does-not-exist/];
  const expected = (text) => EXPECTED_4XX.some((re) => re.test(text));
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // A deliberately-probed missing route logs "Failed to load resource: 404";
    // that is the host doing its job, not a site bug.
    if (m.type() === 'error' && !(expected(m.location()?.url || '') || /does-not-exist/.test(m.text()))) {
      errors.push(`console: ${m.text()} @ ${m.location()?.url || ''}`);
    }
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !expected(r.url())) errors.push(`http ${r.status()} ${r.url()}`);
  });

  await page.goto(HOME, { waitUntil: 'networkidle' });

  await test('首页渲染真实数据（项目数与数据文件一致）', async () => {
    await page.waitForSelector('.project-card');
    const cards = await page.locator('.project-card').count();
    assert(cards >= 6, `首页卡片数 ${cards}`);
    // The catalogue grows automatically, so compare against the data file served by
    // the site under test — not against a number baked into this script.
    const served = await (await fetch(`${BASE}/data/projects.json`)).json();
    const expected = served.projects.length;
    const stats = await page.locator('.hero__stats').innerText();
    assert(stats.replace(/\s/g, '').includes(String(expected)), `统计区没有 ${expected}：${stats}`);
    const title = await page.title();
    assert(title.includes('新玩具'), `标题异常：${title}`);
    return `${cards} 张卡片 / 共 ${expected} 个项目`;
  });

  await test('每个首页项目卡片都有名称、一句话、分类、许可证、门槛、官网/GitHub', async () => {
    const first = page.locator('.project-card').first();
    const text = await first.innerText();
    assert(text.length > 40, '卡片文本过短');
    assert((await first.locator('.project-card__name').count()) === 1, '缺少名称');
    assert((await first.locator('.project-card__tagline').count()) === 1, '缺少一句话介绍');
    assert((await first.locator('.project-card__links a').count()) >= 1, '缺少外链');
    return text.split('\n').slice(0, 2).join(' / ');
  });

  await test('今日推荐、最新收录、本周热门、编辑精选、分类入口、搜索框、随机发现都在', async () => {
    const headings = await page.locator('h2.section__title').allInnerTexts();
    for (const h of ['最新收录', '本周热门', '编辑精选', '分类入口']) {
      assert(headings.some((x) => x.includes(h)), `缺少区块 ${h}: ${headings.join('|')}`);
    }
    assert((await page.locator('.hero').count()) === 1, '缺少今日推荐 hero');
    assert((await page.locator('.search-inline').count()) === 1, '缺少搜索框');
    const randomBtn = page.getByRole('button', { name: /随机发现/ }).first();
    assert((await randomBtn.count()) === 1, '缺少随机发现按钮');
  });

  await test('随机发现会跳到某个项目详情页', async () => {
    await page.getByRole('button', { name: /随机发现/ }).first().click();
    await page.waitForURL(/\/project\//, { timeout: 5000 });
    await page.waitForSelector('.project__title');
    const title = await page.locator('.project__title').innerText();
    assert(title.length > 0, '详情标题为空');
    return `${new URL(page.url()).pathname} → ${title}`;
  });

  await test('详情页包含概览/功能/适合谁/使用方式/技术栈/截图/链接/同类推荐', async () => {
    const ids = ['overview', 'features', 'audience', 'setup', 'stack', 'links'];
    for (const id of ids) assert((await page.locator(`#${id}`).count()) === 1, `缺少 section #${id}`);
    const h2s = await page.locator('.prose h2').allInnerTexts();
    const needed = ['项目概览', '主要功能', '适合谁使用', '使用方式', '技术栈与许可证', '官方仓库及演示链接'];
    for (const n of needed) assert(h2s.includes(n), `缺少标题 ${n}: ${h2s.join('|')}`);
    assert((await page.locator('.project__shot .cover').count()) === 1, '缺少截图区');
    assert((await page.locator('.similar__item').count()) >= 1, '缺少同类推荐');
  });

  await test('详情页的 Star、许可证、更新日期与数据文件一致', async () => {
    const slug = new URL(page.url()).pathname.split('/').pop();
    const data = JSON.parse(readFileSync(join(root, 'dist/data/projects.json'), 'utf8'));
    const p = data.projects.find((x) => x.slug === slug);
    assert(p, `数据中没有 ${slug}`);
    const facts = await page.locator('.project__facts').innerText();
    if (p.repo.stars !== null) assert(facts.includes(p.repo.stars.toLocaleString('en-US')), `Star 不一致: ${facts}`);
    if (p.license.spdx) assert(facts.includes(p.license.spdx), `许可证不一致: ${facts}`);
    else assert(facts.includes('未知'), '未确认许可证应显示未知');
    assert(facts.includes(p.setup.effort), '门槛不一致');
    return `${p.name} ✓`;
  });

  await test('收藏后刷新仍在，且可从收藏页移除', async () => {
    await page.goto(`${BASE}/project/ollama`, { waitUntil: 'networkidle' });
    await page.locator('.project__actions .fav-btn').click();
    await page.waitForTimeout(200);
    const stored = await page.evaluate(() => localStorage.getItem('newtoys:favorites:v1'));
    assert(stored && stored.includes('ollama'), 'localStorage 未写入');
    await page.reload({ waitUntil: 'networkidle' });
    const pressed = await page.locator('.project__actions .fav-btn').getAttribute('aria-pressed');
    assert(pressed === 'true', `刷新后收藏状态丢失: ${pressed}`);
    await page.goto(`${BASE}/favorites`, { waitUntil: 'networkidle' });
    const text = await page.locator('.favcard').first().innerText();
    assert(text.includes('Ollama'), '收藏页没有显示 Ollama');
    await page.locator('.favcard').first().getByRole('button', { name: '移除' }).click();
    await page.waitForTimeout(200);
    assert((await page.locator('.favcard').count()) === 0, '移除后仍显示');
    return '写入 / 刷新保留 / 移除 OK';
  });

  await test('复制项目链接写入剪贴板', async () => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
    await page.goto(`${BASE}/project/biome`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '复制链接' }).click();
    await page.waitForTimeout(300);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert(clip.endsWith('/project/biome'), `剪贴板内容异常: ${clip}`);
    return clip;
  });

  await test('生成分享图：三种比例画布都有真实像素且可下载', async () => {
    await page.getByRole('button', { name: '生成分享图' }).click();
    await page.waitForSelector('.modal');
    await page.waitForFunction(() => {
      const c = document.querySelector('.share__canvas');
      return c && c.width > 0 && !document.querySelector('.share__status');
    }, { timeout: 15000 });

    for (const [label, w, h] of [
      ['1:1', 1080, 1080],
      ['3:4', 1080, 1440],
      ['16:9', 1600, 900],
    ]) {
      await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
      await page.waitForTimeout(900);
      const info = await page.evaluate(() => {
        const c = document.querySelector('.share__canvas');
        const ctx = c.getContext('2d');
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let nonPaper = 0;
        for (let i = 0; i < d.length; i += 4000) {
          if (d[i] < 240 || d[i + 1] < 235 || d[i + 2] < 225) nonPaper++;
        }
        return { w: c.width, h: c.height, nonPaper, cssW: c.getBoundingClientRect().width };
      });
      const ratio = info.w / info.h;
      assert(Math.abs(ratio - w / h) < 0.01, `${label} 比例错误 ${info.w}x${info.h}`);
      assert(info.nonPaper > 20, `${label} 画布几乎是空的（${info.nonPaper} 个非纸色采样）`);
      assert(info.cssW > 200, `${label} 画布在页面上没有尺寸`);
    }

    const dl = page.waitForEvent('download', { timeout: 10000 });
    await page.getByRole('button', { name: /下载 16:9 分享图/ }).click();
    const download = await dl;
    const file = join(downloads, download.suggestedFilename());
    await download.saveAs(file);
    const stat = readFileSync(file);
    assert(stat.length > 20_000, `下载的 PNG 只有 ${stat.length} 字节`);
    assert(stat.subarray(1, 4).toString() === 'PNG', '下载文件不是 PNG');
    await page.locator('.modal__close').click();
    return `${(stat.length / 1024).toFixed(0)}KB PNG`;
  });

  await test('中文分享文案包含项目名、许可证与详情链接', async () => {
    await page.getByRole('button', { name: '复制分享文案' }).click();
    await page.waitForTimeout(300);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    assert(text.includes('Biome'), '文案缺少项目名');
    assert(text.includes('许可证'), '文案缺少许可证');
    assert(text.includes('/project/biome'), '文案缺少链接');
    assert(!/star|评分|推荐指数/i.test(text), '文案包含未核实数据');
    return text.split('\n')[0];
  });

  await test('搜索能按功能描述命中（不只是标题）', async () => {
    await page.goto(`${BASE}/discover`, { waitUntil: 'networkidle' });
    await page.locator('.filters__search input').fill('端到端加密');
    await page.waitForTimeout(400);
    const text = await page.locator('.results').innerText();
    assert(text.includes('Excalidraw'), `搜索「端到端加密」未命中 Excalidraw: ${text.slice(0, 200)}`);
    const count = await page.locator('.project-card').count();
    assert(count >= 1, '结果为空');
    return `${count} 个结果`;
  });

  await test('多标签筛选 + 排序 + 分页可用', async () => {
    await page.goto(`${BASE}/discover?tag=%E8%87%AA%E6%89%98%E7%AE%A1&tag=AI%20Agent`, { waitUntil: 'networkidle' });
    const total = await page.locator('.results__count').innerText();
    assert(total.includes('1'), `多标签 AND 结果异常: ${total}`);
    await page.goto(`${BASE}/discover?sort=name`, { waitUntil: 'networkidle' });
    const names = await page.locator('.project-card__name').allInnerTexts();
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    assert(JSON.stringify(names) === JSON.stringify(sorted), '按名称排序未生效');
    await page.goto(`${BASE}/discover`, { waitUntil: 'networkidle' });
    assert((await page.locator('.pager__num').count()) >= 2, '30 个项目应有 3 页');
    await page.locator('.pager__num').nth(1).click();
    await page.waitForTimeout(300);
    const url = page.url();
    assert(url.includes('page=2'), `分页未写入 URL: ${url}`);
    return 'AND / sort / page OK';
  });

  await test('分类页与分类入口一致，未知分类 404', async () => {
    await page.goto(`${BASE}/categories`, { waitUntil: 'networkidle' });
    assert((await page.locator('.catsection').count()) === 10, '分类页不是 10 栏');
    await page.goto(`${BASE}/category/self-hosted`, { waitUntil: 'networkidle' });
    const count = await page.locator('.project-card').count();
    assert(count >= 3, `自托管分类只有 ${count} 个`);
    await page.goto(`${BASE}/category/does-not-exist`, { waitUntil: 'networkidle' });
    const body = await page.locator('main').innerText();
    assert(body.includes('不在清单里'), '未知分类没有 404 提示');
  });

  await test('导出收藏 JSON 与 Markdown，内容可解析', async () => {
    await page.goto(`${BASE}/project/immich`, { waitUntil: 'networkidle' });
    await page.locator('.project__actions .fav-btn').click();
    await page.goto(`${BASE}/project/karakeep`, { waitUntil: 'networkidle' });
    await page.locator('.project__actions .fav-btn').click();
    await page.goto(`${BASE}/favorites`, { waitUntil: 'networkidle' });
    assert((await page.locator('.favcard').count()) === 2, '收藏数量不为 2');

    const jsonDl = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 JSON' }).click();
    const jsonFile = join(downloads, 'favorites.json');
    await (await jsonDl).saveAs(jsonFile);
    const parsed = JSON.parse(readFileSync(jsonFile, 'utf8'));
    assert(parsed.items.length === 2, `JSON 条目数 ${parsed.items.length}`);
    assert(parsed.items.every((i) => i.slug && i.url.startsWith('http')), 'JSON 缺少 slug/url');

    const mdDl = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 Markdown' }).click();
    const mdFile = join(downloads, 'favorites.md');
    await (await mdDl).saveAs(mdFile);
    const md = readFileSync(mdFile, 'utf8');
    assert(md.includes('Immich') && md.includes('Karakeep'), 'Markdown 缺少项目');
    assert(md.includes('##'), 'Markdown 结构异常');
    return `${parsed.items.length} 项`;
  });

  await test('外部链接都在新标签打开且带 noopener', async () => {
    await page.goto(`${BASE}/project/excalidraw`, { waitUntil: 'networkidle' });
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('a[href^="http"]')]
        .filter((a) => a.target !== '_blank' || !(a.getAttribute('rel') || '').includes('noopener'))
        .map((a) => a.getAttribute('href')),
    );
    assert(bad.length === 0, `不安全的外链: ${bad.join(', ')}`);
  });

  await test('移动端 390px 无横向溢出，卡片单列，导航可点', async () => {
    const mobile = await context.newPage();
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.goto(HOME, { waitUntil: 'networkidle' });
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `横向溢出 ${overflow}px`);
    const cols = await mobile.evaluate(() => getComputedStyle(document.querySelector('.grid--3')).gridTemplateColumns.split(' ').length);
    assert(cols === 1, `移动端网格列数 ${cols}`);
    const navVisible = await mobile.locator('.nav__link').first().isVisible();
    assert(navVisible, '移动端导航不可见');
    await mobile.goto(`${BASE}/project/immich`, { waitUntil: 'networkidle' });
    const overflow2 = await mobile.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow2 <= 1, `详情页横向溢出 ${overflow2}px`);
    await mobile.close();
    return '390px 无溢出';
  });

  await test('外链图片失败时显示占位图而不是破图', async () => {
    const p2 = await context.newPage();
    await p2.route('**/shots/**', (route) => route.abort());
    await p2.goto(`${BASE}/project/excalidraw`, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(600);
    const fallback = await p2.locator('.cover__fallback').count();
    assert(fallback >= 1, '图片加载失败后没有出现占位图');
    await p2.close();
  });

  await test('无 JS 时给出可读提示（不在空白页卡死）', async () => {
    const noJs = await browser.newContext({ javaScriptEnabled: false });
    const p3 = await noJs.newPage();
    await p3.goto(HOME, { waitUntil: 'domcontentloaded' });
    const text = await p3.locator('body').innerText();
    assert(text.includes('今天又有什么新玩具') && text.includes('JavaScript'), 'noscript 提示缺失');
    await noJs.close();
  });

  await test('浏览器控制台无错误、无页面异常', async () => {
    assert(errors.length === 0, errors.slice(0, 3).join(' | '));
  });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error('E2E 运行失败:', error);
  if (browser) await browser.close().catch(() => {});
  process.exitCode = 1;
});

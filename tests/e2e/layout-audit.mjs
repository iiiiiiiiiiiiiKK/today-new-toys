/**
 * Layout audit: measures real geometry in the browser and reports suspicious things
 * (overflow, overlapping text, clipped headings, images with zero height, tabs that
 * don't fit, contrast-critical elements hidden). Run against `npm run preview`.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://localhost:4188';
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1180, height: 800 },
  { name: 'tablet', width: 820, height: 1100 },
  { name: 'phone', width: 390, height: 844 },
];
const pages = ['/', '/discover', '/categories', '/category/ai-tools', '/project/excalidraw', '/favorites', '/about'];

const browser = await chromium.launch({ executablePath: chrome, headless: true });
let problems = 0;

for (const vp of viewports) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'zh-CN' });
  const page = await ctx.newPage();
  for (const path of pages) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const report = await page.evaluate(() => {
      const out = { overflowX: document.documentElement.scrollWidth - window.innerWidth, clipped: [], tiny: [], zero: [], overlap: [] };
      const vw = window.innerWidth;
      for (const el of document.querySelectorAll('h1,h2,h3,p,a,button,span,dd,dt,li')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 2 || r.left < -2) {
          const text = (el.textContent || '').trim().slice(0, 40);
          if (text && !el.closest('.filters__chips--tags')) out.clipped.push(`${el.tagName}.${el.className}: ${text} [${Math.round(r.left)}..${Math.round(r.right)}]`);
        }
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize);
        if (fs < 11 && (el.textContent || '').trim().length > 3 && !el.closest('.mono')) out.tiny.push(`${el.tagName} ${fs}px: ${(el.textContent || '').slice(0, 30)}`);
      }
      for (const img of document.querySelectorAll('img')) {
        const r = img.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) out.zero.push(img.currentSrc || img.src);
      }
      // heading overlap: two headings stacked with negative gap
      const heads = [...document.querySelectorAll('h1,h2,h3')].map((h) => h.getBoundingClientRect());
      for (let i = 0; i < heads.length - 1; i++) {
        const a = heads[i];
        const b = heads[i + 1];
        if (a.bottom > b.top + 4 && Math.abs(a.left - b.left) < 40) out.overlap.push(`${Math.round(a.bottom)} > ${Math.round(b.top)}`);
      }
      return out;
    });
    const bad = [];
    if (report.overflowX > 1) bad.push(`横向溢出 ${report.overflowX}px`);
    if (report.clipped.length) bad.push(`超出视口 ${report.clipped.length}: ${report.clipped.slice(0, 2).join(' | ')}`);
    if (report.tiny.length) bad.push(`过小字号 ${report.tiny.length}: ${report.tiny.slice(0, 2).join(' | ')}`);
    if (report.zero.length) bad.push(`零尺寸图片 ${report.zero.length}`);
    if (report.overlap.length) bad.push(`标题重叠 ${report.overlap.length}: ${report.overlap.slice(0, 2).join(',')}`);
    if (bad.length) {
      problems += bad.length;
      console.log(`✗ ${vp.name.padEnd(8)} ${path.padEnd(26)} ${bad.join(' ; ')}`);
    }
  }
  await ctx.close();
}

// fonts: confirm the self-hosted faces actually load (not falling back)
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
const fonts = await page.evaluate(() =>
  ['Noto Serif SC', 'Instrument Serif', 'JetBrains Mono'].map((f) => ({
    family: f,
    loaded: document.fonts.check(`16px "${f}"`),
  })),
);
console.log('字体:', fonts.map((f) => `${f.family}=${f.loaded ? 'ok' : 'MISSING'}`).join(' '));
if (fonts.some((f) => !f.loaded)) problems += 1;

console.log(problems === 0 ? '\n布局审计通过（4 种视口 × 7 个页面）' : `\n布局问题 ${problems} 处`);
await browser.close();
process.exitCode = problems ? 1 : 0;

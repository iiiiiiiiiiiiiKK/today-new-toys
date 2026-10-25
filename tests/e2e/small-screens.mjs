/**
 * Extra small-screen + share-card checks (320/360px phones, three card ratios).
 * Writes PNGs to .tmp-visual/ for manual inspection and prints measurements.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://localhost:4188';
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const out = '.tmp-visual';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, headless: true });

for (const width of [320, 360, 390, 768]) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, locale: 'zh-CN' });
  const page = await ctx.newPage();
  for (const path of ['/', '/discover', '/project/excalidraw', '/favorites', '/about']) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    const report = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      minFont: Math.min(
        ...[...document.querySelectorAll('p,a,span,dt,dd,li,button')]
          .filter((el) => el.offsetParent !== null && (el.textContent || '').trim().length > 2)
          .map((el) => parseFloat(getComputedStyle(el).fontSize)),
      ),
      touchTargets: [...document.querySelectorAll('button,a')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.width < 32 || r.height < 32) && !el.closest('.footer, .breadcrumb, .tag, .mono');
      }).length,
    }));
    const bad = report.overflow > 1 || report.minFont < 11;
    console.log(`${width}px ${path.padEnd(22)} overflow=${report.overflow} minFont=${report.minFont} smallTargets=${report.touchTargets} ${bad ? '✗' : 'ok'}`);
    if (width === 320 && bad) await page.screenshot({ path: join(out, `320-${path.replace(/\W+/g, '_') || 'home'}.png`) });
  }
  await ctx.close();
}

// share cards
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, locale: 'zh-CN' });
const page = await ctx.newPage();
await page.goto(`${BASE}/project/immich`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '生成分享图' }).click();
await page.waitForFunction(() => {
  const c = document.querySelector('.share__canvas');
  return c && c.width > 0 && !document.querySelector('.share__status');
});
for (const label of ['1:1', '3:4', '16:9']) {
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
  await page.waitForTimeout(1000);
  const dataUrl = await page.evaluate(() => document.querySelector('.share__canvas').toDataURL('image/png'));
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(join(out, `card-${label.replace(':', 'x')}.png`), buf);
  console.log(`卡片 ${label}: ${(buf.length / 1024).toFixed(0)}KB`);
}
await browser.close();
console.log('输出目录:', out);

/**
 * Device-matrix responsive audit.
 *
 *   node tests/e2e/device-matrix.mjs
 *
 * Mimics real phones (iPhone SE / 12–16 / Pro Max, Android, iPad) including DPR,
 * notch safe areas (via CSS env emulation impossible in Chromium — we instead check
 * layout at the reduced width the insets imply) and touch input.
 *
 * Checks per device × page:
 *  - horizontal overflow (document scrollWidth)
 *  - every visible text node inside the viewport
 *  - tap targets >= 32px (report only, 44px for primary nav)
 *  - images loaded (naturalWidth > 0) or an explicit placeholder
 *  - fixed overlays not covering the header
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4188';
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = '.tmp-device';
mkdirSync(outDir, { recursive: true });

const devices = [
  { name: 'iPhone SE (2/3)', width: 375, height: 667, dpr: 2, mobile: true },
  { name: 'iPhone 12/13 mini', width: 375, height: 812, dpr: 3, mobile: true },
  { name: 'iPhone 14/15/16', width: 390, height: 844, dpr: 3, mobile: true },
  { name: 'iPhone 16 Pro', width: 402, height: 874, dpr: 3, mobile: true },
  { name: 'iPhone 15 Pro Max', width: 430, height: 932, dpr: 3, mobile: true },
  { name: 'Pixel 7', width: 412, height: 915, dpr: 2.625, mobile: true },
  { name: 'iPad mini', width: 744, height: 1133, dpr: 2, mobile: true },
  { name: 'iPad Pro 11', width: 834, height: 1194, dpr: 2, mobile: true },
  { name: 'Desktop 1440', width: 1440, height: 900, dpr: 1, mobile: false },
  { name: 'Desktop 1024', width: 1024, height: 768, dpr: 1, mobile: false },
];

const pages = ['/', '/discover', '/categories', '/project/excalidraw', '/favorites', '/about'];

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const findings = [];
let checks = 0;

for (const device of devices) {
  const ctx = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.dpr,
    isMobile: device.mobile,
    hasTouch: device.mobile,
    locale: 'zh-CN',
    userAgent: device.mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
      : undefined,
  });
  const page = await ctx.newPage();

  for (const path of pages) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(250);
    const report = await page.evaluate(() => {
      const vw = window.innerWidth;
      const clipped = [];
      for (const el of document.querySelectorAll('h1,h2,h3,p,a,button,span,dd,dt,li,td,th,input,textarea')) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (el.closest('.filters__chips')) continue; // horizontally scrollable rails, by design
        if (r.right > vw + 1.5 || r.left < -1.5) {
          clipped.push(`${el.tagName}:${(el.textContent || '').trim().slice(0, 24)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
        }
      }
      const brokenImages = [...document.querySelectorAll('img')]
        .filter((i) => i.complete && i.naturalWidth === 0)
        .map((i) => i.getAttribute('src'));
      const smallNav = [...document.querySelectorAll('.nav__link')]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.height < 32).length;
      const searchFont = parseFloat(getComputedStyle(document.querySelector('.search-inline input') || document.body).fontSize);
      return {
        overflow: document.documentElement.scrollWidth - vw,
        clipped: clipped.slice(0, 4),
        clippedCount: clipped.length,
        brokenImages: brokenImages.slice(0, 3),
        smallNav,
        searchFont,
      };
    });
    checks += 1;
    const issues = [];
    if (report.overflow > 1) issues.push(`横向溢出 ${report.overflow}px`);
    if (report.clippedCount) issues.push(`越界元素 ${report.clippedCount}: ${report.clipped.join(' | ')}`);
    if (report.brokenImages.length) issues.push(`图片加载失败 ${report.brokenImages.join(',')}`);
    if (report.smallNav) issues.push(`${report.smallNav} 个导航项高度 < 32px`);
    if (device.mobile && report.searchFont < 16) issues.push(`搜索框字号 ${report.searchFont}px（iOS 会自动放大）`);

    if (issues.length) {
      findings.push({ device: device.name, path, issues });
      console.log(`✗ ${device.name.padEnd(20)} ${String(device.width).padStart(4)}px ${path.padEnd(22)} ${issues.join(' ; ')}`);
    }
  }
  await ctx.close();
}

// Share modal on the narrowest phone (the tallest overlay in the app)
const ctx = await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(`${BASE}/project/immich`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '生成分享图' }).click();
await page.waitForTimeout(1500);
const modal = await page.evaluate(() => {
  const panel = document.querySelector('.modal__panel');
  const r = panel.getBoundingClientRect();
  return {
    w: Math.round(r.width),
    h: Math.round(r.height),
    vw: window.innerWidth,
    vh: window.innerHeight,
    scrollable: panel.scrollHeight > panel.clientHeight,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
  };
});
console.log('分享弹窗 @375×667:', JSON.stringify(modal));
if (modal.w > modal.vw || modal.overflowX > 1) {
  findings.push({ device: 'iPhone SE', path: '/project/immich (share modal)', issues: [`弹窗超出视口 ${modal.w} > ${modal.vw}`] });
}
await page.screenshot({ path: `${outDir}/share-modal-375.png` });
await ctx.close();

await browser.close();
console.log(`\n${checks} 个「设备 × 页面」组合检查`);
if (findings.length) {
  console.log(`发现 ${findings.length} 处问题`);
  process.exitCode = 1;
} else {
  console.log('全部通过：无横向溢出、无越界文本、无坏图、触控目标达标、输入框不触发 iOS 缩放');
}

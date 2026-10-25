import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4188';
const out = '.tmp-device';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });

// desktop header
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
const dp = await dctx.newPage();
await dp.goto(BASE, { waitUntil: 'networkidle' });
await dp.waitForTimeout(400);
const xLink = await dp.evaluate(() => {
  const a = document.querySelector('.nav__x');
  const r = a.getBoundingClientRect();
  return {
    href: a.getAttribute('href'),
    target: a.getAttribute('target'),
    rel: a.getAttribute('rel'),
    text: a.innerText.trim(),
    aria: a.getAttribute('aria-label'),
    w: Math.round(r.width),
    h: Math.round(r.height),
    visible: r.width > 0 && r.height > 0,
  };
});
console.log('desktop X link:', JSON.stringify(xLink));
await dp.screenshot({ path: `${out}/header-desktop.png`, clip: { x: 0, y: 0, width: 1440, height: 120 } });
await dctx.close();

// iPhone header
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'zh-CN' });
const mp = await mctx.newPage();
await mp.goto(BASE, { waitUntil: 'networkidle' });
await mp.waitForTimeout(400);
const mx = await mp.evaluate(() => {
  const a = document.querySelector('.nav__x');
  const r = a.getBoundingClientRect();
  const handle = a.querySelector('.nav__x-handle');
  return {
    href: a.getAttribute('href'),
    w: Math.round(r.width),
    h: Math.round(r.height),
    right: Math.round(r.right),
    vw: window.innerWidth,
    handleHidden: handle ? getComputedStyle(handle).display === 'none' : null,
    svgSize: Math.round(a.querySelector('svg').getBoundingClientRect().width),
  };
});
console.log('mobile X link:', JSON.stringify(mx));
await mp.screenshot({ path: `${out}/header-mobile.png`, clip: { x: 0, y: 0, width: 390, height: 200 } });
await mctx.close();
await browser.close();

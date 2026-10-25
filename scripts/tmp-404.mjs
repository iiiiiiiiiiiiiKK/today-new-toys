import { chromium } from 'playwright-core';

const BASE = 'https://iiiiiiiiiiiiikk.github.io/today-new-toys/';
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
const page = await ctx.newPage();
const bad = [];
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
page.on('requestfailed', (r) => bad.push(`FAILED ${r.url()}`));
for (const path of ['', 'discover/', 'project/immich/', 'about/']) {
  bad.length = 0;
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  console.log(path || '/', '→', bad.length ? bad.join(' | ') : 'no 4xx');
}
await browser.close();

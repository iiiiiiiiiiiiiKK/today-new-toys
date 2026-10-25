/**
 * Capture one real screenshot per project from its official site / live demo.
 *
 *   node scripts/capture-shots.mjs            # all
 *   node scripts/capture-shots.mjs biome uv   # subset
 *
 * Images go to public/shots/<slug>.webp (+ <slug>-card.webp, 800px wide for grids).
 * Runs are logged; a failure simply leaves the project on the local placeholder and
 * records `screenshotError`, it never substitutes a fake product image.
 */
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PATHS, createLogger, readJson, writeJson } from './lib/fs.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const config = readJson(join(PATHS.root, 'data', 'shots.json'), { shots: [] }).shots;
const logger = createLogger('capture');
const tmp = join(PATHS.root, '.tmp-shots');
const outDir = join(PATHS.root, 'public', 'shots');
mkdirSync(tmp, { recursive: true });
mkdirSync(outDir, { recursive: true });

const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ['--ignore-certificate-errors', '--disable-dev-shm-usage', '--hide-scrollbars'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: 'zh-CN',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});
context.setDefaultTimeout(25_000);

const manifestPath = join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

const CONSENT = [
  /^(accept all|accept all cookies|accept cookies|accept|i agree|allow all|got it)$/i,
  /^(同意|接受全部|接受|全部接受|我同意|知道了|同意并继续)$/,
];

async function dismissConsent(page) {
  for (const name of ['Accept all', 'Accept cookies', 'Accept', '同意', '接受全部', '接受', '知道了']) {
    const btn = page.getByRole('button', { name, exact: true }).first();
    if (await btn.count().catch(() => 0)) {
      await btn.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
  // Generic cookie banners that only expose a link
  for (const text of ['Accept all', 'Accept']) {
    const link = page.getByText(text, { exact: true }).first();
    if (await link.count().catch(() => 0)) {
      await link.click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}

function isProbablyBlank(pngPath) {
  // Python/Pillow check: stddev of a 64x40 thumbnail. A blank page is ~0.
  const code = `from PIL import Image,ImageStat
im=Image.open(r"${pngPath}").convert("RGB").resize((64,40))
s=ImageStat.Stat(im); print(max(s.stddev))`;
  const out = execFileSync('python', ['-c', code], { encoding: 'utf8' }).trim();
  return Number(out) < 4;
}

for (const shot of config) {
  if (args.length && !args.includes(shot.slug)) continue;
  const page = await context.newPage();
  const started = Date.now();
  try {
    logger.info('goto', `${shot.slug} ${shot.captureUrl}`);
    await page.goto(shot.captureUrl, { waitUntil: 'domcontentloaded', timeout: 35_000 });
    await page.waitForTimeout(shot.origin === 'live' ? 4200 : 2600);
    await dismissConsent(page);
    // Give lazy heroes/fonts a moment, then nudge the page like a reader would.
    await page.mouse.wheel(0, 260);
    await page.waitForTimeout(1400);
    await page.mouse.wheel(0, -260);
    await page.waitForTimeout(600);

    const png = join(tmp, `${shot.slug}.png`);
    await page.screenshot({ path: png, type: 'png', animations: 'disabled' });
    if (isProbablyBlank(png)) throw new Error('截图接近空白，判定失败');

    const webp = join(outDir, `${shot.slug}.webp`);
    const card = join(outDir, `${shot.slug}-card.webp`);
    execFileSync('python', ['-c', `
from PIL import Image
im = Image.open(r"${png}").convert("RGB")
im.save(r"${webp}", "WEBP", quality=82, method=6)
w = 880
h = round(im.height * w / im.width)
im.resize((w, h), Image.LANCZOS).save(r"${card}", "WEBP", quality=80, method=6)
print(im.size)
`], { encoding: 'utf8' });

    const title = await page.title();
    manifest[shot.slug] = {
      src: `/shots/${shot.slug}.webp`,
      card: `/shots/${shot.slug}-card.webp`,
      captureUrl: shot.captureUrl,
      origin: shot.origin,
      title,
      capturedAt: new Date().toISOString(),
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    logger.info('saved', `${shot.slug} ${Date.now() - started}ms ${JSON.stringify(title).slice(0, 60)}`);
  } catch (error) {
    manifest[shot.slug] = {
      ...(manifest[shot.slug] || {}),
      error: String(error.message || error).split('\n')[0],
      attemptedAt: new Date().toISOString(),
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    logger.warn('failed', `${shot.slug}: ${String(error.message || error).split('\n')[0]}`);
  } finally {
    await page.close().catch(() => {});
  }
}

await browser.close();
rmSync(tmp, { recursive: true, force: true });
const result = logger.finish({ total: Object.keys(manifest).length, failed: Object.values(manifest).filter((m) => m.error).length });
console.log(`\n截图清单: ${manifestPath}\n运行日志: ${result.file}`);

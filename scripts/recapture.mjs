/**
 * Second pass for pages that were blank / slow on the first run.
 *
 * Same contract as capture-shots.mjs: real page, real screenshot, honest failure.
 * Adds: network-idle wait, CMP (cookie banner) handling for the common vendors,
 * a lazy-load scroll, and a blank-frame retry with a longer settle time.
 */
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PATHS, createLogger } from './lib/fs.mjs';

const RETRY = {
  'open-webui': { url: 'https://openwebui.com', wait: 7000, scroll: 700 },
  'lobe-chat': { url: 'https://lobehub.com', wait: 9000, scroll: 700 },
  ollama: { url: 'https://ollama.com', wait: 5000 },
  excalidraw: { url: 'https://excalidraw.com', wait: 4000, click: true },
  hoppscotch: { url: 'https://hoppscotch.io', wait: 7000 },
  markitdown: { url: 'https://github.com/microsoft/markitdown', wait: 6000, full: false },
  evidence: { url: 'https://demo.evidence.dev', wait: 9000 },
  penpot: { url: 'https://design.penpot.app', wait: 9000 },
  'cs-self-learning': { url: 'https://csdiy.wiki', wait: 9000 },
  'flipper-zero': { url: 'https://flipperzero.one', wait: 7000 },
  sherlock: { url: 'https://sherlockproject.xyz', wait: 6000 },
  'metamask-extension': { url: 'https://metamask.io', wait: 8000, consent: true },
};

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const logger = createLogger('recapture');
const outDir = join(PATHS.root, 'public', 'shots');
const tmp = join(PATHS.root, '.tmp-shots2');
mkdirSync(tmp, { recursive: true });
const manifestPath = join(outDir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ['--ignore-certificate-errors', '--hide-scrollbars', '--disable-blink-features=AutomationControlled'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});
context.setDefaultTimeout(30_000);

async function killBanners(page) {
  const selectors = [
    '#onetrust-accept-btn-handler',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    'button[data-testid="cookie-policy-manage-dialog-accept-button"]',
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("Accept")',
    'button:has-text("I agree")',
    'button:has-text("同意")',
    'button:has-text("接受全部")',
    'button:has-text("接受")',
    'button:has-text("Got it")',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) {
      await el.click({ timeout: 1200, force: true }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  // Remove leftover fixed overlays that are pure banners
  await page
    .evaluate(() => {
      for (const el of document.querySelectorAll('div,section,aside')) {
        const s = getComputedStyle(el);
        if ((s.position === 'fixed' || s.position === 'sticky') && el.getBoundingClientRect().height > window.innerHeight * 0.6) {
          const t = (el.textContent || '').toLowerCase();
          if (t.includes('cookie') && t.length < 600) el.remove();
        }
      }
    })
    .catch(() => {});
}

function score(png) {
  const code = `from PIL import Image,ImageStat,ImageFilter
im=Image.open(r"${png}").convert("RGB")
l=im.convert("L")
print(round(max(ImageStat.Stat(im).stddev),1), round(ImageStat.Stat(l.filter(ImageFilter.FIND_EDGES)).mean[0],2))`;
  const [std, edge] = execFileSync('python', ['-c', code], { encoding: 'utf8' }).trim().split(/\s+/).map(Number);
  return { std, edge };
}

for (const [slug, cfg] of Object.entries(RETRY)) {
  if (only.length && !only.includes(slug)) continue;
  const page = await context.newPage();
  try {
    logger.info('goto', `${slug} ${cfg.url}`);
    await page.goto(cfg.url, { waitUntil: 'domcontentloaded', timeout: 40_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(cfg.wait || 5000);
    if (cfg.consent) await killBanners(page);
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    if (cfg.scroll) {
      await page.mouse.wheel(0, cfg.scroll);
      await page.waitForTimeout(1500);
      await page.mouse.wheel(0, -cfg.scroll);
      await page.waitForTimeout(900);
    }
    if (cfg.click) {
      await page.mouse.click(720, 450);
      await page.waitForTimeout(600);
    }
    const png = join(tmp, `${slug}.png`);
    await page.screenshot({ path: png, type: 'png', animations: 'disabled', timeout: 30_000 });
    let s = score(png);
    if (s.std < 12 || s.edge < 1.6) {
      logger.warn('retry_blank', `${slug} std=${s.std} edge=${s.edge}`);
      await page.waitForTimeout(6000);
      await page.screenshot({ path: png, type: 'png', animations: 'disabled' });
      s = score(png);
    }
    if (s.std < 12 || s.edge < 1.6) throw new Error(`画面接近空白 std=${s.std} edge=${s.edge}`);

    const webp = join(outDir, `${slug}.webp`);
    const card = join(outDir, `${slug}-card.webp`);
    execFileSync('python', ['-c', `
from PIL import Image
im = Image.open(r"${png}").convert("RGB")
im.save(r"${webp}", "WEBP", quality=84, method=6)
w = 880
h = round(im.height * w / im.width)
im.resize((w, h), Image.LANCZOS).save(r"${card}", "WEBP", quality=80, method=6)
`], { encoding: 'utf8' });

    const title = await page.title();
    manifest[slug] = {
      src: `/shots/${slug}.webp`,
      card: `/shots/${slug}-card.webp`,
      captureUrl: cfg.url,
      origin: slug === 'markitdown' ? 'og' : 'live',
      title,
      capturedAt: new Date().toISOString(),
      quality: s,
    };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    logger.info('saved', `${slug} std=${s.std} edge=${s.edge} ${JSON.stringify(title).slice(0, 50)}`);
  } catch (error) {
    // keep the previous entry, but record why this attempt failed
    manifest[slug] = { ...(manifest[slug] || {}), error: String(error.message || error).split('\n')[0], attemptedAt: new Date().toISOString() };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    logger.warn('failed', `${slug}: ${String(error.message || error).split('\n')[0]}`);
  } finally {
    await page.close().catch(() => {});
  }
}

await browser.close();
rmSync(tmp, { recursive: true, force: true });
const result = logger.finish({ ok: Object.values(manifest).filter((m) => !m.error).length, failed: Object.values(manifest).filter((m) => m.error).length });
console.log(`运行日志: ${result.file}`);

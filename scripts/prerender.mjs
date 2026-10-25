import { chromium } from 'playwright-core';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { PATHS } from './lib/fs.mjs';
import { siteConfig } from './lib/site.mjs';

/**
 * Prerender every route to static HTML.
 *
 *   node scripts/prerender.mjs            (runs as part of `npm run build`)
 *
 * The site is a SPA, but project pages need real shareable URLs with their own
 * <title>/og:image for crawlers and link previews. We render the app in a headless
 * browser against the freshly built bundle, then write dist/project/<slug>/index.html.
 * `404.html` + `_redirects` keep deep links working on plain static hosts.
 *
 * Works for root deploys and sub-path deploys (GitHub Pages project sites):
 * SITE_ORIGIN / TOYS_BASE are resolved once in scripts/lib/site.mjs.
 */
const dist = join(PATHS.root, 'dist');
const data = JSON.parse(readFileSync(join(dist, 'data', 'projects.json'), 'utf8'));
const chrome = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const site = siteConfig();
const port = Number(process.env.PRERENDER_PORT || 4188);

const routes = [
  '/',
  '/discover',
  '/categories',
  '/favorites',
  '/about',
  ...data.categories.map((c) => `/category/${c.id}`),
  ...data.projects.map((p) => `/project/${p.slug}`),
];

console.log(`预渲染 ${routes.length} 个路由…`);

const server = spawn(
  process.execPath,
  [join(PATHS.root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(port), '--strictPort'],
  { cwd: PATHS.root, stdio: 'ignore' },
);

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

let browser;
let page;

async function launch() {
  browser = await chromium.launch({ executablePath: chrome, headless: true, args: ['--disable-dev-shm-usage'] });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
}

/** One route → one HTML string. Retries once on a fresh browser if Chrome crashed. */
async function renderRoute(route) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (!browser || !browser.isConnected()) await launch();
      await page.goto(site.local(port, route), { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForSelector('.project-card, .hero, .pagehead, .state', { timeout: 15000 }).catch(() => {});
      const html = await page.content();
      const title = await page.title();
      const desc = await page.getAttribute('meta[name="description"]', 'content').catch(() => null);
      return { html, title, desc };
    } catch (error) {
      if (attempt === 2) throw error;
      console.warn(`\n[prerender] ${route} 失败（${String(error.message).split('\n')[0]}），重启浏览器重试`);
      await browser?.close().catch(() => {});
      browser = null;
    }
  }
  throw new Error('unreachable');
}

try {
  if (!existsSync(chrome)) throw new Error(`找不到 Chrome：${chrome}（可用 CHROME_PATH 指定）`);
  const up = await waitForServer(site.local(port, '/'));
  if (!up) throw new Error('vite preview 未能在 25 秒内启动');

  await launch();

  for (const route of routes) {
    const { html, title, desc } = await renderRoute(route);

    // The preview server serves dist/index.html, which this loop rewrites. Strip any
    // tags a previous iteration injected so the head never accumulates duplicates.
    let out = html
      .replace(/[ \t]*<link rel="canonical"[^>]*>\s*/g, '')
      .replace(/[ \t]*<meta property="og:url"[^>]*>\s*/g, '')
      .replace(/[ \t]*<meta name="twitter:image"[^>]*>\s*/g, '');

    if (title) out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
    if (desc) out = out.replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeAttr(desc)}$2`);
    if (title) out = out.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${escapeAttr(title)}$2`);
    if (desc) out = out.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${escapeAttr(desc)}$2`);

    // Link previews always use the generated 1200×630 card, never the raw screenshot.
    const slug = route.startsWith('/project/') ? route.split('/')[2] : null;
    const ogPath = slug ? `/og/${slug}.png` : '/og/default.png';
    const ogUrl = `${site.siteRoot}${ogPath}`;
    out = out.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${escapeAttr(ogUrl)}$2`);
    out = out.replace(/(<meta property="og:type" content=")[^"]*(")/, `$1${slug ? 'article' : 'website'}$2`);

    const canonical = site.url(route);
    const extras = [
      `<link rel="canonical" href="${escapeAttr(canonical)}" />`,
      `<meta property="og:url" content="${escapeAttr(canonical)}" />`,
      `<meta name="twitter:image" content="${escapeAttr(ogUrl)}" />`,
    ].join('\n    ');
    out = out.replace('</head>', `  ${extras}\n  </head>`);

    const dir = route === '/' ? dist : join(dist, route.replace(/^\//, ''));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), out, 'utf8');
    process.stdout.write('.');
  }
  console.log(`\n完成：${routes.length} 个页面（${site.siteRoot}）`);

  const home = readFileSync(join(dist, 'index.html'), 'utf8');
  writeFileSync(join(dist, '404.html'), home, 'utf8');
  // Netlify / Cloudflare Pages read _redirects from the site root. On a GitHub Pages
  // project site the file simply sits unused next to 404.html.
  writeFileSync(
    join(dist, '_redirects'),
    ['/project/*  /project/:splat  200', '/category/*  /category/:splat  200', '/*  /index.html  200', ''].join('\n'),
    'utf8',
  );
  writeFileSync(join(dist, '.nojekyll'), '', 'utf8');

  const urls = routes.map((r) => `  <url><loc>${escapeXml(site.url(r))}</loc></url>`).join('\n');
  writeFileSync(
    join(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    'utf8',
  );
  const items = data.projects
    .map(
      (p) =>
        `    <item><title>${escapeXml(p.name)} — ${escapeXml(p.tagline)}</title><link>${escapeXml(site.url(`/project/${p.slug}`))}</link><guid>${escapeXml(site.url(`/project/${p.slug}`))}</guid><pubDate>${new Date(p.addedAt).toUTCString()}</pubDate><description>${escapeXml(p.summary)}</description></item>`,
    )
    .join('\n');
  writeFileSync(
    join(dist, 'feed.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>今天又有什么新玩具</title><link>${escapeXml(site.siteRoot)}/</link><description>中文开源项目与互联网工具发现</description><language>zh-CN</language>\n${items}\n</channel></rss>\n`,
    'utf8',
  );
  console.log('已写入 404.html / _redirects / sitemap.xml / feed.xml');
} catch (error) {
  console.warn(`\n[prerender] 跳过：${error.message}`);
  console.warn('[prerender] SPA 仍可部署（含 404.html 回退），但每个项目页将只在前端渲染。');
  if (existsSync(join(dist, 'index.html'))) {
    writeFileSync(join(dist, '404.html'), readFileSync(join(dist, 'index.html'), 'utf8'), 'utf8');
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
  setTimeout(() => process.exit(0), 400);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
function escapeXml(s) {
  return escapeAttr(s);
}

/**
 * Quota-free fallback: parse the JSON GitHub embeds in the public repo page.
 *
 * Used only when there is no GITHUB_TOKEN and the anonymous 60 req/h API budget is
 * exhausted. GitHub's HTML changes often, so every field is optional and the caller
 * records a warning; nothing here is guessed.
 */
import { extractJsonObject } from './embedded-json.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export async function scrapeRepoPage(owner, name, fetchImpl = fetch) {
  const url = `https://github.com/${owner}/${name}`;
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
  if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  const html = await res.text();

  const about = extractJsonObject(html, 'sidebarAboutData') ?? {};
  const route = extractJsonObject(html, 'codeViewLayoutRoute')?.repo ?? {};
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  const ogDesc = html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] ?? null;
  const licSpan = html.match(/<a[^>]+href="[^"]*\/blob\/[^"]*LICENSE[^"]*"[^>]*>[\s\S]{0,200}?<span[^>]*>([^<]+)<\/span>/)?.[1] ?? null;
  const updated = html.match(/<relative-time[^>]*datetime="([^"]+)"/)?.[1] ?? null;

  if (!title || !about.stargazerCount && !title.includes('/')) {
    return { ok: false, status: 200, error: '页面结构无法解析（GitHub 可能改了模板）' };
  }

  const description = about.description || (ogDesc ? decodeEntities(ogDesc).split(' - GitHub - ')[0] : null);
  const licenseName = licSpan ? decodeEntities(licSpan).trim() : null;

  return {
    ok: true,
    source: 'scrape',
    data: {
      owner,
      name,
      fullName: `${owner}/${name}`,
      url,
      homepage: about.website || null,
      description: description ? decodeEntities(description).trim() : null,
      stars: typeof about.stargazerCount === 'number' ? about.stargazerCount : null,
      forks: typeof about.forksCount === 'number' ? about.forksCount : null,
      openIssues: null,
      language: null,
      topics: Array.isArray(about.topics) ? about.topics.map((t) => t.name) : [],
      license: licenseName
        ? { spdx: null, name: licenseName, note: '许可证名称来自 GitHub 页面展示，SPDX 标识需人工确认', url: null }
        : { spdx: null, name: null, note: '页面未展示许可证，需人工确认', url: null },
      createdAt: route.createdAt || null,
      pushedAt: updated,
      archived: typeof route.isArchived === 'boolean' ? route.isArchived : null,
      fetchedAt: new Date().toISOString(),
      source: 'manual',
      warnings: ['GitHub API 额度不足：本条为网页兜底抓取，开放 issue 数、语言、推送时间可能缺失'],
      _scraped: true,
    },
  };
}

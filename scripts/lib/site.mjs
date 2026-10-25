/**
 * Where the site will live. One place to compute URLs so prerender, postbuild,
 * sitemap and feed all agree.
 *
 *   SITE_ORIGIN  full site root, including any sub-path, without trailing slash
 *                e.g. https://iiiiiiiiiiiiKK.github.io/today-new-toys
 *   TOYS_BASE    Vite base, with slashes: "/" or "/today-new-toys/"
 *
 * When SITE_ORIGIN is not set we fall back to an example domain and derive the base
 * from TOYS_BASE, so local builds keep working.
 */
export function siteConfig() {
  const base = (process.env.TOYS_BASE || '/').replace(/\/?$/, '/');
  const basePath = base.replace(/\/$/, '');
  const explicit = process.env.SITE_ORIGIN?.replace(/\/$/, '');
  const fallbackOrigin = 'https://newtoys.example.com';
  const siteRoot = explicit || `${fallbackOrigin}${basePath}`;
  return {
    base,
    basePath,
    siteRoot,
    /** Absolute URL for a route ("/" or "/project/x"). */
    url: (route) => `${siteRoot}${route === '/' ? '/' : route}`,
    /** URL the local preview server serves this route at. */
    local: (port, route) => `http://localhost:${port}${basePath}${route === '/' ? '/' : route}`,
  };
}

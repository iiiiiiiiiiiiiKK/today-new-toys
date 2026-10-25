/**
 * Asset URLs stored in the data file are root-absolute (`/shots/x.webp`).
 * When the site is deployed under a sub-path (`TOYS_BASE=/toys/`) they must be
 * prefixed at render time. One helper, used everywhere an image or link is emitted.
 */
const BASE = import.meta.env.BASE_URL || '/';

export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  const clean = path.replace(/^\//, '');
  return `${BASE.replace(/\/$/, '')}/${clean}`;
}

/**
 * Small, boring helpers: class names, stable hashing, date formatting.
 * No external dependency on purpose — the whole site is static and light.
 */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '未知';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '未知';
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** "3 天前" style, but honest about our own snapshot date rather than the visitor's clock. */
export function relativeTo(iso: string | null | undefined, reference: string): string {
  if (!iso) return '未知';
  const a = new Date(iso).getTime();
  const b = new Date(reference).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return '未知';
  const days = Math.floor((b - a) / 86_400_000);
  if (days < 0) return fmtDate(iso);
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

/** Deterministic shuffle: same seed + same list = same order, so pages stay stable. */
export function seededShuffle<T>(list: T[], seed: number): T[] {
  const out = [...list];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function titleCaseTag(tag: string): string {
  return tag
    .split('-')
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Pick the leading "中文名" out of "Excalidraw（白板）" without breaking names that have none. */
export function latinName(name: string): string {
  const m = name.match(/^([A-Za-z0-9][A-Za-z0-9 .+#_/-]*?)(?:\s*[（(]|$)/);
  return (m?.[1] || name).trim();
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '未知';
  return n.toLocaleString('en-US');
}

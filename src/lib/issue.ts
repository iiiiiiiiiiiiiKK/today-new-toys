/**
 * Build errors (v1/v2). The two letters are a shared "voice": the header shows
 * the current issue code, every project gets a stable one derived from its slug.
 * NONE of these mean failure — that is the joke. `E` = 探索 / 试验, `R` = 收藏 / 复看.
 */
type IssueSeed = [letter: string, number: string, phrase: string];

const E: IssueSeed[] = [
  ['E', '01', '探索'],
  ['E', '07', '试用'],
  ['E', '12', '原型'],
  ['E', '23', '折腾'],
  ['E', '31', '迭代'],
  ['E', '48', '实验'],
  ['E', '55', '编译'],
  ['E', '67', '沙盒'],
  ['E', '73', '试玩'],
  ['E', '80', '加更'],
];
const R: IssueSeed[] = [
  ['R', '02', '收藏'],
  ['R', '09', '回看'],
  ['R', '14', '回顾'],
  ['R', '19', '召回'],
  ['R', '27', '重读'],
  ['R', '36', '随手记'],
  ['R', '42', '书签'],
  ['R', '58', '旧玩具'],
  ['R', '64', '复刻'],
  ['R', '91', '玩第二遍'],
];

const SEEDS = [...E, ...R];

/** Tiny deterministic string hash (FNV-1a) so an issue code never changes for a slug. */
export function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface IssueCode {
  /** e.g. "E72" */
  id: string;
  /** e.g. "E72 · 折腾" */
  label: string;
  phrase: string;
  letter: string;
  number: number;
}

export function issueFor(slug: string): IssueCode {
  const seed = SEEDS[hash(slug) % SEEDS.length];
  const n = (hash(slug + '#n') % 999) + 1;
  const number = String(n).padStart(3, '0');
  return {
    id: `${seed[0]}${number}`,
    label: `${seed[0]}${number} · ${seed[2]}`,
    phrase: seed[2],
    letter: seed[0],
    number: n,
  };
}

/** The issue the site is "currently on". Fixed per calendar week so it feels alive but stable. */
export function currentIssue(now = new Date()): IssueCode {
  const week = Math.floor(now.getTime() / (7 * 24 * 3600 * 1000));
  const n = (week % 900) + 100;
  return {
    id: `E${n}`,
    label: `E${n} · ${['折腾', '试用', '探索', '编译', '加更', '试验'][n % 6]}`,
    phrase: '今天又有什么新玩具',
    letter: 'E',
    number: n,
  };
}

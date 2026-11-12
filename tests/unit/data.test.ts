import { describe, expect, it } from 'vitest';
import {
  filterProjects,
  allTags,
  similar,
  featured,
  PAGE_SIZE,
  __setData,
  type DataFile,
  todayPicks,
  randomProject,
  boardCoverage,
  boardSpan,
  boardValue,
  feedEvents,
  feedKindLabel,
  rankProjects,
  shippedWithin,
} from '../../src/lib/data';
import type { Project } from '../../src/data/types';
import { issueFor } from '../../src/lib/issue';
import { fmtDate, relativeTo, seededShuffle, hashString } from '../../src/lib/utils';

function project(overrides: Partial<Project> & { slug: string }): Project {
  const base: Project = {
    slug: overrides.slug,
    name: overrides.slug,
    tagline: '一句话介绍',
    summary: '摘要。',
    category: 'ai-tools',
    categoryName: 'AI 工具',
    tags: ['ai', 'self-hosted'],
    audience: '开发者',
    audienceFor: ['需要的人'],
    features: [
      { title: 'a', detail: 'b' },
      { title: 'c', detail: 'd' },
      { title: 'e', detail: 'f' },
    ],
    contentBasis: '依据 README.md 整理',
    setup: { effort: '低门槛', effortNote: '', requires: [], steps: [{ title: 's', detail: 'd' }], cost: '免费' },
    license: { spdx: 'MIT', name: 'MIT License' },
    repo: {
      owner: 'o',
      name: overrides.slug,
      fullName: `o/${overrides.slug}`,
      url: `https://github.com/o/${overrides.slug}`,
      homepage: null,
      description: null,
      stars: 100,
      forks: null,
      openIssues: null,
      language: 'TypeScript',
      topics: [],
      license: { spdx: 'MIT', name: 'MIT License' },
      createdAt: null,
      pushedAt: '2026-10-01T00:00:00Z',
      archived: false,
      fetchedAt: '2026-10-20T00:00:00Z',
      source: 'api',
    },
    officialUrl: null,
    demoUrl: null,
    linkStatus: 'ok',
    linkCheckedAt: null,
    screenshots: [],
    readme: { path: 'README.md', excerpt: null, headings: [], chars: 1000, fetchedAt: '2026-10-20T00:00:00Z', truncated: false },
    featured: false,
    addedAt: '2026-10-01',
    updatedAt: '2026-10-01',
    popularityScore: 50,
    weeklyScore: 50,
    momentum: {
      stars: 1000,
      day: null,
      week: null,
      month: null,
      commits1w: 10,
      commits4w: 40,
      commits52w: 500,
      commitTotal: 1000,
      latestRelease: null,
      latestPrerelease: null,
      velocity: null,
      measuredAt: '2026-10-25',
    },
    review: { status: 'published', reviewedBy: '编辑部', reviewedAt: '2026-10-01' },
  };
  return { ...base, ...overrides };
}

const data: DataFile = {
  generatedAt: '2026-10-25T00:00:00Z',
  snapshotDate: '2026-10-25',
  counts: { projects: 4, categories: 1 },
  categories: [{ id: 'ai-tools', name: 'AI 工具', english: 'AI Tools', blurb: '', intro: '' }],
  seed: [1],
  projects: [
    project({ slug: 'alpha', name: 'Alpha', tagline: '自托管聊天', tags: ['ai', 'chat'], featured: true, popularityScore: 90 }),
    project({ slug: 'beta', name: 'Beta', tagline: 'SQL 图表', category: 'data-viz', categoryName: '数据可视化', tags: ['sql'], popularityScore: 80, audience: '数据团队' }),
    project({ slug: 'gamma', name: 'Gamma', tagline: '键盘固件', category: 'hardware', categoryName: '开源硬件', tags: ['keyboard'], popularityScore: 70, license: { spdx: null, name: null, note: '未声明' } }),
    project({ slug: 'delta', name: 'Delta', tagline: '另一个工具', summary: '特别的功能描述 ZEBRA', tags: ['ai'], popularityScore: 60 }),
  ],
};

__setData(data);

describe('filterProjects', () => {
  const base = { q: '', categories: [], tags: [], audience: null, license: 'any' as const, sort: 'recommended' as const, page: 1 };

  it('returns everything with default filters', () => {
    expect(filterProjects(data, base).total).toBe(4);
  });

  it('searches taglines, summaries and features, not only names', () => {
    expect(filterProjects(data, { ...base, q: 'SQL' }).items.map((p) => p.slug)).toEqual(['beta']);
    expect(filterProjects(data, { ...base, q: 'zebra' }).items.map((p) => p.slug)).toEqual(['delta']);
    expect(filterProjects(data, { ...base, q: '键盘' }).items.map((p) => p.slug)).toEqual(['gamma']);
  });

  it('combines multiple tags with AND semantics', () => {
    expect(filterProjects(data, { ...base, tags: ['ai', 'chat'] }).total).toBe(1);
    expect(filterProjects(data, { ...base, tags: ['ai', 'keyboard'] }).total).toBe(0);
  });

  it('filters by category and audience', () => {
    expect(filterProjects(data, { ...base, categories: ['data-viz'] }).items[0].slug).toBe('beta');
    expect(filterProjects(data, { ...base, audience: '数据团队' }).items[0].slug).toBe('beta');
  });

  it('can hide projects without a confirmed licence', () => {
    expect(filterProjects(data, { ...base, license: 'known' }).items.map((p) => p.slug)).not.toContain('gamma');
  });

  it('sorts and paginates deterministically', () => {
    const sorted = filterProjects(data, { ...base, sort: 'name' });
    expect(sorted.items.map((p) => p.slug)).toEqual(['alpha', 'beta', 'delta', 'gamma']);
    expect(PAGE_SIZE).toBeGreaterThan(1);
  });

  it('clamps an out-of-range page instead of returning nothing', () => {
    const r = filterProjects(data, { ...base, page: 99 });
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.length).toBe(4);
  });
});

describe('helpers', () => {
  it('collects tags with counts', () => {
    const tags = allTags(data);
    expect(tags.find((t) => t.tag === 'ai')?.count).toBe(2);
    expect(tags).toHaveLength(4);
  });

  it('recommends projects that share category, tags or audience', () => {
    const others = similar(data, data.projects[0]);
    expect(others.map((p) => p.slug)).not.toContain('alpha');
    expect(others[0].slug).toBe('delta'); // shares the 'ai' tag, ranked first
    expect(others.length).toBe(3);
  });

  it('featured() only returns featured projects', () => {
    expect(featured(data).map((p) => p.slug)).toEqual(['alpha']);
  });

  it('todayPicks is stable within a day and never repeats', () => {
    const a = todayPicks(data, 3, new Date('2026-10-25T08:00:00Z')).map((p) => p.slug);
    const b = todayPicks(data, 3, new Date('2026-10-25T20:00:00Z')).map((p) => p.slug);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it('randomProject excludes the current project', () => {
    for (let i = 0; i < 20; i++) expect(randomProject(data, 'alpha').slug).not.toBe('alpha');
  });
});

describe('formatting & issue codes', () => {
  it('formats ISO dates as YYYY.MM.DD and keeps unknown explicit', () => {
    expect(fmtDate('2026-03-09T12:00:00Z')).toBe('2026.03.09');
    expect(fmtDate(null)).toBe('未知');
    expect(fmtDate('not-a-date')).toBe('未知');
  });

  it('describes recency relative to the snapshot date, not the device clock', () => {
    expect(relativeTo('2026-10-24T00:00:00Z', '2026-10-25')).toBe('昨天');
    expect(relativeTo('2026-10-01T00:00:00Z', '2026-10-25')).toBe('24 天前');
    expect(relativeTo(null, '2026-10-25')).toBe('未知');
  });

  it('gives every slug a stable issue code', () => {
    expect(issueFor('excalidraw').id).toBe(issueFor('excalidraw').id);
    expect(issueFor('excalidraw').id).toMatch(/^[ER]\d{3}$/);
  });

  it('shuffles reproducibly for a given seed', () => {
    const a = seededShuffle([1, 2, 3, 4, 5], 42);
    const b = seededShuffle([1, 2, 3, 4, 5], 42);
    expect(a).toEqual(b);
    expect(a.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(hashString('abc')).toBe(hashString('abc'));
  });
});

describe('ranking boards', () => {
  const snapshot = '2026-11-12';
  const board = (overrides: Partial<Project> & { slug: string }) => {
    const p = project({
      ...overrides,
      repo: {
        ...project({ slug: 'x' }).repo,
        pushedAt: overrides.repo?.pushedAt ?? null,
        ...overrides.repo,
      },
    });
    return p;
  };
  const withMomentum = (
    slug: string,
    m: Partial<Project['momentum']>,
    extra: Partial<Project> = {},
  ) =>
    board({
      slug,
      ...extra,
      momentum: {
        stars: null,
        day: null,
        week: null,
        month: null,
        commits1w: null,
        commits4w: null,
        commits52w: null,
        commitTotal: null,
        latestRelease: null,
        latestPrerelease: null,
        velocity: null,
        measuredAt: snapshot,
        ...m,
      },
    });

  const data: DataFile = {
    generatedAt: '2026-11-12T00:00:00Z',
    snapshotDate: snapshot,
    counts: { projects: 3, categories: 1 },
    categories: [],
    seed: [],
    projects: [
      // Most commits this week, pushed today.
      withMomentum('hot', { commits1w: 90, commits4w: 300, stars: 500 }, {
        repo: { ...project({ slug: 'hot' }).repo, pushedAt: '2026-11-12T08:00:00Z' },
      }),
      // Fewer commits but shipped a release inside the window.
      withMomentum('shipped', {
        commits1w: 10,
        commits4w: 40,
        stars: 9000,
        latestRelease: {
          tag: 'v9.0.0',
          name: 'v9.0.0',
          url: null,
          publishedAt: '2026-11-11T00:00:00Z',
          prerelease: false,
          draft: false,
        },
      }),
      // Only a prerelease; must not be treated as a shipped release.
      withMomentum('nightly', {
        commits1w: 5,
        commits4w: 20,
        stars: 70000,
        latestPrerelease: {
          tag: 'nightly-1',
          name: 'nightly-1',
          url: null,
          publishedAt: '2026-11-11T00:00:00Z',
          prerelease: true,
          draft: false,
        },
      }),
    ],
  };

  it('orders the weekly board strictly by the weekly commit count it displays', () => {
    const rows = rankProjects(data, 'week', 10);
    expect(rows.map((p) => p.slug)).toEqual(['hot', 'shipped', 'nightly']);
    expect(boardValue(rows[0], 'week')).toBe('90 次');
  });

  it('does not let a release reorder the board above a busier repo', () => {
    // `shipped` has 9k stars and a fresh release; `hot` still wins on commits.
    const rows = rankProjects(data, 'week', 10);
    expect(rows[0].slug).toBe('hot');
  });

  it('labels shipped releases as badges rather than weights', () => {
    expect(shippedWithin(data.projects[1], 'week', snapshot)).toBe(true);
    expect(shippedWithin(data.projects[2], 'week', snapshot)).toBe(false);
  });

  it('keeps nightly builds out of the release slot and flags them in the feed', () => {
    const nightly = data.projects[2];
    expect(nightly.momentum.latestRelease).toBeNull();
    const kinds = feedEvents(data, 50).filter((e) => e.project.slug === 'nightly').map((e) => e.kind);
    expect(kinds).toContain('prerelease');
    expect(kinds).not.toContain('release');
    expect(feedKindLabel('prerelease')).toBe('预发布');
  });

  it('ranks the rising board by stars per day over the real span', () => {
    const rising: DataFile = {
      ...data,
      projects: [
        withMomentum('fast', {
          day: { delta: 20, from: '2026-11-11', to: '2026-11-12', requestedDays: 1, spanDays: 1 },
        }),
        withMomentum('long-window', {
          month: { delta: 300, from: '2026-10-13', to: '2026-11-12', requestedDays: 30, spanDays: 30 },
        }),
        withMomentum('thin', { day: null, week: null, month: null }),
      ],
    };
    const rows = rankProjects(rising, 'rising', 10);
    // 20★/day beats 300★/30d (=10★/day): the longer window must not win by size alone.
    expect(rows.map((p) => p.slug)).toEqual(['fast', 'long-window']);
    expect(boardValue(rows[0], 'rising')).toBe('+20 ★/天');
    expect(boardValue(rows[1], 'rising')).toBe('+10 ★/天');
    expect(boardValue(rising.projects[2], 'rising')).toBe('数据不足');
    expect(boardSpan(rising.projects[1])).toContain('300');
    expect(boardSpan(rising.projects[1])).toContain('30 天');
  });

  it('drops a project from a board when its only signal is missing, instead of scoring 0', () => {
    const rows = rankProjects(data, 'month', 10);
    expect(rows.every((p) => p.momentum.commits4w !== null)).toBe(true);
    expect(boardCoverage(data, 'month')).toBe(3);
    const none: DataFile = { ...data, projects: [withMomentum('empty', {})] };
    expect(rankProjects(none, 'week', 10)).toEqual([]);
    expect(boardCoverage(none, 'week')).toBe(0);
  });
});

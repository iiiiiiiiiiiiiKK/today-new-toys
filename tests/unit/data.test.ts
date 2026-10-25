import { describe, expect, it } from 'vitest';
import { filterProjects, allTags, similar, featured, PAGE_SIZE, __setData, type DataFile, todayPicks, randomProject } from '../../src/lib/data';
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

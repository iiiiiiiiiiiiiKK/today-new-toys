import { describe, expect, it } from 'vitest';
import { parseRepoInput, digestReadme, normalizeLicense, repoRecord, statusFromRepo } from '../../scripts/lib/github.mjs';
import { normalizeUrl, slugify } from '../../scripts/lib/fs.mjs';

describe('parseRepoInput', () => {
  it('accepts the forms a person actually pastes', () => {
    expect(parseRepoInput('https://github.com/withastro/astro')).toEqual({ owner: 'withastro', repo: 'astro' });
    expect(parseRepoInput('https://github.com/withastro/astro.git')).toEqual({ owner: 'withastro', repo: 'astro' });
    expect(parseRepoInput('https://github.com/withastro/astro/tree/main/packages')).toEqual({ owner: 'withastro', repo: 'astro' });
    expect(parseRepoInput('withastro/astro')).toEqual({ owner: 'withastro', repo: 'astro' });
    expect(parseRepoInput('git@github.com:withastro/astro.git')).toEqual({ owner: 'withastro', repo: 'astro' });
    expect(parseRepoInput('  https://www.github.com/withastro/astro/  ')).toEqual({ owner: 'withastro', repo: 'astro' });
  });

  it('rejects non-GitHub and malformed input instead of guessing', () => {
    expect(parseRepoInput('https://gitlab.com/foo/bar')).toBeNull();
    expect(parseRepoInput('https://github.com/onlyowner')).toBeNull();
    expect(parseRepoInput('')).toBeNull();
    expect(parseRepoInput('not a repo')).toBeNull();
  });
});

describe('digestReadme', () => {
  const md = `# Project\n\n[![badge](https://img.shields.io/x)](https://example.com)\n\nA tool that does **things**.\n\n## Features\n\n- Fast\n- Small\n\n\`\`\`bash\nnpm i\n\`\`\`\n`;

  it('strips badges, code fences and markup, and keeps headings', () => {
    const d = digestReadme(md);
    expect(d.headings).toContain('Project');
    expect(d.headings).toContain('Features');
    expect(d.excerpt).toContain('A tool that does things');
    expect(d.excerpt).not.toContain('shields.io');
    expect(d.excerpt).not.toContain('npm i');    expect(d.chars).toBeGreaterThan(10);
    expect(d.truncated).toBe(false);
  });

  it('handles a missing README without pretending', () => {
    expect(digestReadme('')).toEqual({ excerpt: null, headings: [], chars: 0, truncated: false });
    expect(digestReadme(null)).toEqual({ excerpt: null, headings: [], chars: 0, truncated: false });
  });

  it('flags truncation for long READMEs', () => {
    const d = digestReadme('x'.repeat(3000), { limit: 200 });
    expect(d.truncated).toBe(true);
    expect(d.excerpt).toHaveLength(200);
  });
});

describe('normalizeLicense', () => {
  it('keeps real SPDX ids', () => {
    expect(normalizeLicense({ spdx_id: 'MIT', name: 'MIT License' })).toMatchObject({ spdx: 'MIT', name: 'MIT License' });
  });
  it('treats NOASSERTION as unknown with a note', () => {
    const l = normalizeLicense({ spdx_id: 'NOASSERTION', name: 'Other' });
    expect(l.spdx).toBeNull();
    expect(l.note).toContain('LICENSE');
  });
  it('treats a missing licence as unknown', () => {
    expect(normalizeLicense(null).spdx).toBeNull();
  });
});

describe('repoRecord & status', () => {
  const api = {
    owner: { login: 'o' },
    name: 'r',
    full_name: 'o/r',
    html_url: 'https://github.com/o/r',
    homepage: 'https://r.dev',
    description: null,
    stargazers_count: 1234,
    forks_count: 5,
    open_issues_count: 2,
    language: 'Go',
    topics: ['a'],
    license: { spdx_id: 'MIT', name: 'MIT License' },
    created_at: '2020-01-01T00:00:00Z',
    pushed_at: '2026-10-20T00:00:00Z',
    archived: false,
  };

  it('maps API fields and stamps fetchedAt', () => {
    const r = repoRecord(api, '2026-10-25T00:00:00Z');
    expect(r.stars).toBe(1234);
    expect(r.fetchedAt).toBe('2026-10-25T00:00:00Z');
    expect(r.source).toBe('api');
    expect(r.license.spdx).toBe('MIT');
  });

  it('classifies activity from pushed_at', () => {
    expect(statusFromRepo({ ...repoRecord(api), pushedAt: new Date().toISOString() })).toBe('active');
    expect(statusFromRepo({ ...repoRecord(api), archived: true })).toBe('archived');
    expect(statusFromRepo({ ...repoRecord(api), pushedAt: '2019-01-01T00:00:00Z' })).toBe('unknown');
  });
});

describe('slug & url helpers', () => {
  it('slugifies repo names safely', () => {
    expect(slugify('MetaMask Extension')).toBe('metamask-extension');
    expect(slugify('  weird__name!!')).toBe('weird-name');
  });
  it('normalises urls for duplicate detection', () => {
    expect(normalizeUrl('https://www.Example.com/foo/')).toBe('example.com/foo');
    expect(normalizeUrl('not a url')).toBeNull();
  });
});

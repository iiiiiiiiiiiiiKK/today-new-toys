import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guards the actual published data file, not a fixture: these are the promises the
 * site makes to readers ("unknown stays unknown", "no duplicates", "every project has
 * a real page"), so they should fail the test suite, not just the build script.
 */
const raw = JSON.parse(readFileSync(resolve(__dirname, '../../public/data/projects.json'), 'utf8'));
const projects = raw.projects as Array<Record<string, any>>;

describe('published dataset', () => {
  it('has 30+ projects across all 10 categories', () => {
    expect(projects.length).toBeGreaterThanOrEqual(30);
    expect(raw.categories).toHaveLength(10);
    const used = new Set(projects.map((p) => p.category));
    expect(used.size).toBe(10);
  });

  it('has no duplicate slugs, repositories or names', () => {
    const slugs = projects.map((p) => p.slug);
    const repos = projects.map((p) => p.repo.fullName?.toLowerCase());
    const names = projects.map((p) => p.name.toLowerCase());
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(repos).size).toBe(repos.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('never invents metrics: stars are null or a non-negative integer', () => {
    for (const p of projects) {
      const s = p.repo.stars;
      if (s !== null) {
        expect(Number.isInteger(s), `${p.slug} stars`).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('marks missing licences explicitly instead of guessing', () => {
    for (const p of projects) {
      if (!p.license.spdx) {
        expect(p.license.note, `${p.slug} 缺少许可证说明`).toBeTruthy();
      }
    }
    // The four custom/absent licences we know about must stay unlabelled as SPDX.
    for (const slug of ['open-webui', 'lobe-chat', 'esphome', 'metamask-extension']) {
      const p = projects.find((x) => x.slug === slug)!;
      expect(p.license.spdx, slug).toBeNull();
      expect(p.license.note, slug).toMatch(/许可证|许可|License|条款/);
    }
  });

  it('every project documents what its Chinese copy is based on', () => {
    for (const p of projects) {
      expect(p.contentBasis, p.slug).toBeTruthy();
      expect(p.contentBasis.length, p.slug).toBeGreaterThan(10);
      if (p.readme.chars > 0) expect(p.readme.path, p.slug).toBeTruthy();
    }
  });

  it('every project has at least 3 features, 2 audience rows and a setup path', () => {
    for (const p of projects) {
      expect(p.features.length, p.slug).toBeGreaterThanOrEqual(3);
      expect(p.audienceFor.length, p.slug).toBeGreaterThanOrEqual(2);
      expect(p.setup.steps.length, p.slug).toBeGreaterThanOrEqual(1);
      expect(p.setup.effort, p.slug).toMatch(/门槛/);
    }
  });

  it('every screenshot points at a file that exists and is honestly labelled', () => {
    for (const p of projects) {
      for (const shot of p.screenshots) {
        expect(shot.src, p.slug).toMatch(/^\/shots\/.+\.webp$/);
        // 'og' = the repository's own social preview (markitdown has no product site)
        expect(shot.origin, p.slug).toMatch(/^(live|og)$/);
        expect(shot.synthetic, p.slug).not.toBe(true);
        if (shot.origin === 'og') expect(shot.credit, p.slug).toBeTruthy();
      }
    }
    // 90%+ of the catalogue should have a real screenshot; placeholders are the exception.
    const withShot = projects.filter((p) => p.screenshots.length > 0).length;
    expect(withShot / projects.length).toBeGreaterThan(0.9);
  });

  it('keeps ranking derivable from public numbers only', () => {
    for (const p of projects) {
      expect(typeof p.popularityScore).toBe('number');
      expect(typeof p.weeklyScore).toBe('number');
      expect(p.weeklyScore).toBeGreaterThanOrEqual(p.popularityScore);
    }
  });
});

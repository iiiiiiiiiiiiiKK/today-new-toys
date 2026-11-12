import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DataFile } from '../../src/lib/data';

/**
 * Guards against the failure that froze the catalogue at 39 for two weeks:
 * a push replaced the remote tree with the local working copy, deleting every project
 * the daily bot had added. These assertions are cheap and catch the regression class
 * the accidental deletion belongs to.
 */
const root = join(__dirname, '..', '..');
const data: DataFile = JSON.parse(readFileSync(join(root, 'public', 'data', 'projects.json'), 'utf8'));
const manifest: Record<string, unknown> = JSON.parse(
  readFileSync(join(root, 'public', 'shots', 'manifest.json'), 'utf8'),
);

describe('published catalogue', () => {
  it('is not accidentally truncated', () => {
    // A working-copy push once published 39 while 73 project files existed.
    expect(data.projects.length).toBeGreaterThanOrEqual(60);
    expect(data.counts.projects).toBe(data.projects.length);
  });

  it('publishes every project that has an editorial file', () => {
    const files = readFileSync(join(root, 'data', 'projects', 'ollama.json'), 'utf8');
    expect(JSON.parse(files).slug).toBe('ollama');
    expect(data.projects.some((p) => p.slug === 'ollama')).toBe(true);
  });

  it('resolves a screenshot for every project with a manifest entry', () => {
    // Images on disk without a manifest row render as "no screenshot", which is how
    // 33 restored projects briefly looked broken.
    const slugsWithManifest = Object.keys(manifest);
    expect(slugsWithManifest.length).toBeGreaterThanOrEqual(60);
    const missing = data.projects.filter((p) => slugsWithManifest.includes(p.slug) && p.screenshots.length === 0);
    expect(missing.map((p) => p.slug)).toEqual([]);
  });

  it('keeps every momentum block deserialisable', () => {
    for (const p of data.projects) {
      expect(p.momentum, p.slug).toBeTruthy();
      // Pre-release must never occupy the stable-release slot.
      if (p.momentum.latestRelease) expect(p.momentum.latestRelease.prerelease, p.slug).toBe(false);
    }
  });

  it('never reports a zero-day star window', () => {
    for (const p of data.projects) {
      for (const window of [p.momentum.day, p.momentum.week, p.momentum.month]) {
        if (window) expect(window.spanDays).toBeGreaterThan(0);
      }
    }
  });
});

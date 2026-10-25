/**
 * Type shims for the ingest scripts, which are plain ESM JavaScript so they can run
 * under `node scripts/...` without a build step. Tests import them directly; only the
 * members used in tests are declared here.
 */
declare module '*lib/github.mjs' {
  export interface ParsedRepo {
    owner: string;
    repo: string;
  }
  export function parseRepoInput(input: string): ParsedRepo | null;
  export function digestReadme(
    markdown: string | null,
    opts?: { limit?: number },
  ): {
    excerpt: string | null;
    headings: string[];
    chars: number;
    truncated: boolean;
  };
  export function normalizeLicense(license: { spdx_id?: string; name?: string } | null): {
    spdx: string | null;
    name: string | null;
    note?: string;
    url: string | null;
  };
  export function repoRecord(json: Record<string, unknown>, fetchedAt?: string): Record<string, any>;
  export function statusFromRepo(repo: Record<string, any>): string;
  export function createClient(opts?: Record<string, unknown>): Record<string, any>;
}

declare module '*lib/fs.mjs' {
  export function slugify(input: string): string;
  export function normalizeUrl(url: string | null | undefined): string | null;
}

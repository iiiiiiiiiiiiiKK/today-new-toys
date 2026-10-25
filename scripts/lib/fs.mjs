import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PATHS = {
  root: ROOT,
  sources: join(ROOT, 'data', 'sources.json'),
  categories: join(ROOT, 'data', 'categories.json'),
  projectsDir: join(ROOT, 'data', 'projects'),
  publicData: join(ROOT, 'public', 'data'),
  logs: join(ROOT, 'data', 'logs'),
};

export function readJson(file, fallback = null) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

export function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function projectFiles() {
  if (!existsSync(PATHS.projectsDir)) return [];
  return readdirSync(PATHS.projectsDir)
    // `_template.json` / `_notes.json` are documentation, not catalogue entries.
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => join(PATHS.projectsDir, f))
    .sort();
}

export function loadProjects() {
  return projectFiles().map((file) => ({ file, project: readJson(file) }));
}

/** Append-only JSONL run log. Never rewritten, so a previous run's evidence survives. */
export function createLogger(name) {
  mkdirSync(PATHS.logs, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(PATHS.logs, `${name}-${stamp}.jsonl`);
  const startedAt = new Date().toISOString();
  const write = (entry) => {
    appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, 'utf8');
    if (entry.level !== 'debug') {
      const detail = entry.detail ? ` ${entry.detail}` : '';
      console.log(`[${entry.at ?? ''}] ${entry.level ?? 'info'} ${entry.event ?? ''}${detail}`);
    }
  };
  write({ event: 'run_start', name, startedAt, cwd: process.cwd(), node: process.version });
  return {
    file,
    info: (event, detail) => write({ event, detail, level: 'info' }),
    warn: (event, detail) => write({ event, detail, level: 'warn' }),
    error: (event, detail) => write({ event, detail, level: 'error' }),
    http: (entry) => write({ level: 'debug', ...entry }),
    finish(summary) {
      write({ event: 'run_end', level: 'info', detail: JSON.stringify(summary) });
      return { file, summary };
    },
  };
}

export function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function normalizeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return null;
  }
}

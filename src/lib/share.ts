import type { Project } from '../data/types';

/** Absolute, shareable URL for a project (respects sub-path deployments). */
export function projectUrl(slug: string): string {
  const base = import.meta.env.BASE_URL || '/';
  if (typeof window === 'undefined') return `${base}project/${slug}`;
  return `${window.location.origin}${base.replace(/\/$/, '')}/project/${slug}`;
}

/**
 * Chinese share copy. Deliberately short and factual: name, one-liner, category,
 * licence, and the two links we actually have. Nothing that we cannot verify
 * (stars, ratings, author praise) is ever added here.
 */
export function shareText(project: Project): string {
  const lines: string[] = [];
  lines.push(`【今天又有什么新玩具】${project.name}`);
  lines.push(project.tagline);
  lines.push('');
  lines.push(`${project.summary.split('。')[0]}。`);
  lines.push(`分类：${project.categoryName ?? project.category}｜门槛：${project.setup.effort}｜适合：${project.audience}`);  lines.push(`许可证：${project.license.spdx ? `${project.license.name ?? project.license.spdx}（${project.license.spdx}）` : '未知（仓库未声明可识别许可证，详见页面）'}`);
  if (project.officialUrl) lines.push(`官网：${project.officialUrl}`);
  if (project.repo.url) lines.push(`仓库：${project.repo.url}`);
  lines.push(`详情：${projectUrl(project.slug)}`);
  lines.push('');
  lines.push('未取得的数据一律标注为未知，不含推测。');
  return lines.join('\n');
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // http:// origins and older browsers: fall back to a hidden textarea
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

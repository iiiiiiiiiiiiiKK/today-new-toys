/**
 * Site-level configuration that is not content.
 *
 * Set `VITE_REPO_URL` at build time if you publish this catalogue in a public repo:
 * the "建议修订" entry then opens a prefilled GitHub issue. Without it, the same
 * dialog still works — it just gives the user the text to paste somewhere.
 */
export const SITE = {
  repoUrl: (import.meta.env.VITE_REPO_URL as string | undefined)?.replace(/\/$/, '') || null,
  title: '今天又有什么新玩具',
};

export interface RevisionRequest {
  slug: string;
  name: string;
  field: string;
  message: string;
}

/** Build the issue body a reader would submit. Kept plain so it can be pasted anywhere. */
export function revisionBody(req: RevisionRequest, pageUrl: string): string {
  return [
    `**项目**：${req.name}（\`${req.slug}\`）`,
    `**页面**：${pageUrl}`,
    `**需要修订的字段**：${req.field || '（未填写）'}`,
    '',
    '**问题描述 / 更正内容**：',
    req.message || '（请描述哪里不对，最好附上可核实的来源）',
    '',
    '---',
    '提交前请确认：更正内容有公开来源（README、LICENSE、官网），并注明来源链接。本站不接受没有依据的 Star 数、评分或活跃度补写。',
  ].join('\n');
}

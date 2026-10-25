import { useState } from 'react';
import type { Project } from '../data/types';
import { useToast } from '../context/ToastContext';
import { copyToClipboard } from '../lib/share';
import { projectUrl } from '../lib/share';
import { revisionBody, SITE } from '../lib/site';

/**
 * Manual revision entry point for auto-generated or stale copy.
 * No backend: it produces a prefilled issue (or a paste-ready block) that a maintainer
 * applies to `data/projects/<slug>.json`, then re-runs `data:check`.
 */
export function RevisionDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  const [field, setField] = useState('summary');
  const [message, setMessage] = useState('');
  const { show } = useToast();
  const body = revisionBody({ slug: project.slug, name: project.name, field, message }, projectUrl(project.slug));
  const issueUrl = SITE.repoUrl
    ? `${SITE.repoUrl}/issues/new?title=${encodeURIComponent(`[内容修订] ${project.name}（${project.slug}）`)}&body=${encodeURIComponent(body)}`
    : null;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rev-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__panel modal__panel--narrow">
        <header className="modal__head">
          <div>
            <p className="eyebrow">Fix · 人工修订</p>
            <h2 className="modal__title" id="rev-title">
              {project.name}
            </h2>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="关闭" type="button">
            ✕
          </button>
        </header>

        <p className="rev__intro">
          这一条的内容依据是：<span className="rev__basis">{project.contentBasis}</span>
          <br />
          如果发现事实错误，请指明字段并给出可核实的来源。修订会写回 <code>data/projects/{project.slug}.json</code>，经人工确认后重新构建。
        </p>

        <label className="rev__label mono" htmlFor="rev-field">
          需要修订的字段
        </label>
        <select id="rev-field" className="rev__select" value={field} onChange={(e) => setField(e.target.value)}>
          <option value="summary">项目概览</option>
          <option value="features">主要功能</option>
          <option value="audienceFor">适合谁使用</option>
          <option value="setup">使用方式 / 门槛</option>
          <option value="license">许可证</option>
          <option value="links">官网 / 仓库 / 演示链接</option>
          <option value="stats">Star / 更新时间</option>
          <option value="screenshot">截图</option>
        </select>

        <label className="rev__label mono" htmlFor="rev-msg">
          更正内容与来源
        </label>
        <textarea id="rev-msg" className="share__text" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="例：README 的 Roadmap 一节写明该功能尚未发布；来源：https://github.com/…" />

        <div className="rev__actions">
          {issueUrl ? (
            <a className="btn btn--accent btn--sm" href={issueUrl} target="_blank" rel="noopener noreferrer">
              在 GitHub 提交修订建议 ↗
            </a>
          ) : (
            <span className="rev__hint mono">未配置 VITE_REPO_URL：复制下方内容，贴到项目仓库的 issue 或 PR。</span>
          )}
          <button
            className="btn btn--sm"
            type="button"
            onClick={async () => {
              const ok = await copyToClipboard(body);
              show(ok ? '修订说明已复制' : '复制失败', ok ? 'ok' : 'warn');
            }}
          >
            复制修订说明
          </button>
        </div>
      </div>
    </div>
  );
}

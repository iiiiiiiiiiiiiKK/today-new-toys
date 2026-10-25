import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DataGate } from '../components/DataGate';
import { Cover } from '../components/Cover';
import { useDataReady } from '../context/DataContext';
import { useFavorites } from '../context/FavoritesContext';
import { useToast } from '../context/ToastContext';
import { copyToClipboard, projectUrl } from '../lib/share';
import { fmtDate } from '../lib/utils';

/** Markdown export: readable in any editor, easy to paste into a note or an issue. */
function toMarkdown(items: Array<{ slug: string; name: string; tagline: string; url: string; repo: string | null; category: string; license: string; addedAt: string }>): string {
  const lines = [`# 我的玩具收藏`, '', `导出于 ${new Date().toLocaleString('zh-CN')}，共 ${items.length} 项。`, ''];
  for (const it of items) {
    lines.push(`## ${it.name}`);
    lines.push('');
    lines.push(it.tagline);
    lines.push('');
    lines.push(`- 分类：${it.category}`);
    lines.push(`- 许可证：${it.license}`);
    lines.push(`- 收录：${it.addedAt}`);
    lines.push(`- 详情：${it.url}`);
    if (it.repo) lines.push(`- 仓库：${it.repo}`);
    lines.push('');
  }
  return lines.join('\n');
}

export function FavoritesPage() {
  return (
    <DataGate label="正在整理你的收藏…">
      <FavoritesInner />
    </DataGate>
  );
}

function FavoritesInner() {
  const data = useDataReady();
  const fav = useFavorites();
  const { show } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);

  const items = useMemo(
    () =>
      fav.entries
        .map((entry) => ({ entry, project: data.projects.find((p) => p.slug === entry.slug) }))
        .filter((x): x is { entry: typeof x.entry; project: NonNullable<typeof x.project> } => Boolean(x.project)),
    [fav.entries, data.projects],
  );

  const exportItems = items.map(({ project, entry }) => ({
    slug: project.slug,
    name: project.name,
    tagline: project.tagline,
    url: projectUrl(project.slug),
    repo: project.repo.url,
    category: project.categoryName ?? project.category,
    license: project.license.spdx ?? '未知',
    addedAt: fmtDate(entry.addedAt.slice(0, 10)),
  }));

  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  const missing = fav.entries.length - items.length;

  return (
    <div>
      <header className="pagehead">
        <p className="eyebrow">Saved · 本地收藏</p>
        <div className="pagehead__row">
          <h1 className="pagehead__title">
            我的收藏 <span className="pagehead__count mono">{String(items.length).padStart(2, '0')}</span>
          </h1>
          <p className="pagehead__lede">收藏保存在这台设备的浏览器里（localStorage），不需要账号，也不会同步到任何服务器。换设备请用下面的导出。</p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="empty">
          <p className="empty__title">还没有收藏。</p>
          <p>在任意项目卡片或详情页点书签图标即可加入；刷新后仍然在。</p>
          <div className="empty__actions">
            <Link className="btn btn--ink" to="/discover">
              去挑几个
            </Link>
            <Link className="btn btn--ghost" to="/categories">
              按分类逛
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="toolbar">
            <p className="toolbar__info mono">共 {items.length} 项 · 本地存储</p>
            <div className="toolbar__actions">
              <button
                className="btn btn--sm"
                onClick={() => {
                  download('favorites.json', JSON.stringify({ exportedAt: new Date().toISOString(), items: exportItems }, null, 2), 'application/json');
                  show('JSON 已开始下载');
                }}
              >
                导出 JSON
              </button>
              <button
                className="btn btn--sm"
                onClick={() => {
                  download('favorites.md', toMarkdown(exportItems), 'text/markdown;charset=utf-8');
                  show('Markdown 已开始下载');
                }}
              >
                导出 Markdown
              </button>
              <button
                className="btn btn--sm"
                onClick={async () => {
                  const ok = await copyToClipboard(toMarkdown(exportItems));
                  show(ok ? '收藏列表已复制为 Markdown' : '复制失败', ok ? 'ok' : 'warn');
                }}
              >
                复制列表
              </button>
              {confirmClear ? (
                <>
                  <button
                    className="btn btn--sm btn--accent"
                    onClick={() => {
                      fav.clear();
                      setConfirmClear(false);
                      show('已清空本地收藏');
                    }}
                  >
                    确认清空
                  </button>
                  <button className="btn btn--sm btn--ghost" onClick={() => setConfirmClear(false)}>
                    取消
                  </button>
                </>
              ) : (
                <button className="btn btn--sm btn--ghost" onClick={() => setConfirmClear(true)}>
                  清空
                </button>
              )}
            </div>
          </div>

          {missing > 0 ? <p className="toolbar__warn">有 {missing} 条收藏对应的项目已不在当前清单中，已跳过。</p> : null}

          <div className="grid grid--3">
            {items.map(({ project, entry }) => (
              <article key={project.slug} className="favcard">
                <Link to={`/project/${project.slug}`} aria-label={project.name}>
                  <Cover src={project.screenshots[0]?.card || null} alt={project.screenshots[0]?.alt || project.name} name={project.name} />
                </Link>
                <div className="favcard__body">
                  <h2 className="favcard__name">
                    <Link to={`/project/${project.slug}`}>{project.name}</Link>
                  </h2>
                  <p className="favcard__tag">{project.tagline}</p>
                  <p className="favcard__meta mono">收藏于 {fmtDate(entry.addedAt.slice(0, 10))}</p>
                  <div className="favcard__actions">
                    <button
                      className="btn btn--sm"
                      onClick={async () => {
                        const ok = await copyToClipboard(projectUrl(project.slug));
                        show(ok ? '链接已复制' : '复制失败', ok ? 'ok' : 'warn');
                      }}
                    >
                      复制链接
                    </button>
                    <button
                      className="btn btn--sm btn--ghost"
                      onClick={() => {
                        fav.remove(project.slug);
                        show(`已移除 ${project.name}`);
                      }}
                    >
                      移除
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

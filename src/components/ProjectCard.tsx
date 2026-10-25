import { Link } from 'react-router-dom';
import type { Project } from '../data/types';
import { useFavorites } from '../context/FavoritesContext';
import { fmtDate, relativeTo } from '../lib/utils';
import { Cover } from './Cover';
import { useData } from '../context/DataContext';

export function FavButton({ slug, name, withLabel = false }: { slug: string; name: string; withLabel?: boolean }) {
  const { has, toggle } = useFavorites();
  const on = has(slug);
  return (
    <button
      type="button"
      className={`fav-btn ${on ? 'is-on' : ''} ${withLabel ? 'fav-btn--label' : ''}`}
      aria-pressed={on}
      aria-label={on ? `取消收藏 ${name}` : `收藏 ${name}`}
      title={on ? '取消收藏' : '收藏'}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(slug);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
        <path d="M6 3.8h12a.8.8 0 0 1 .8.8v15.2L12 16.3l-6.8 3.5V4.6a.8.8 0 0 1 .8-.8Z" strokeLinejoin="round" />
      </svg>
      {withLabel ? <span>{on ? '已收藏' : '收藏'}</span> : null}
    </button>
  );
}

export function ProjectCard({ project, showCover = true, badge }: { project: Project; showCover?: boolean; badge?: string }) {
  const { state } = useData();
  const snapshot = state.status === 'ready' ? state.data.snapshotDate : null;
  const shot = project.screenshots[0];
  const categoryName = project.categoryName ?? project.category;

  return (
    <article className="project-card">
      {showCover ? (
        <Link to={`/project/${project.slug}`} aria-label={`查看 ${project.name}`} className="project-card__coverlink">
          <Cover
            src={shot?.card || shot?.src || null}
            alt={shot?.alt || `${project.name} 封面`}
            name={project.name}
            label={badge}
            fallbackNote={shot ? undefined : 'NO SCREENSHOT · 未取得可用截图'}
          />
        </Link>
      ) : null}

      <div className="project-card__head">
        <h3 className="project-card__name">
          <Link to={`/project/${project.slug}`}>{project.name}</Link>
        </h3>
        <FavButton slug={project.slug} name={project.name} />
      </div>

      <p className="project-card__tagline">{project.tagline}</p>

      <div className="project-card__meta">
        <Link className="pill pill--accent" to={`/category/${project.category}`}>
          {categoryName}
        </Link>
        {project.review.mode === 'auto' ? (
          <span className="pill pill--auto" title="由自动流水线收录，中文文案未经人工校对">
            自动收录
          </span>
        ) : null}
        {project.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="tag">
            #{tag}
          </span>
        ))}
        <span className="dot">·</span>
        <span className="mono">{project.license.spdx ?? '许可证未知'}</span>
      </div>

      <div className="project-card__meta" style={{ marginTop: 0 }}>
        <span title="适用人群">面向 {project.audience}</span>
        <span className="dot">·</span>
        <span title="体验门槛">门槛 {project.setup.effort}</span>
        <span className="dot">·</span>
        <span className="mono" title={project.repo.pushedAt ? `仓库最近推送 ${fmtDate(project.repo.pushedAt)}` : '仓库推送时间未知'}>
          {project.repo.pushedAt ? `更新 ${relativeTo(project.repo.pushedAt, snapshot || project.addedAt)}` : '更新未知'}
        </span>
      </div>

      <div className="project-card__links">
        <Link to={`/project/${project.slug}`}>详情 →</Link>
        {project.officialUrl ? (
          <a href={project.officialUrl} target="_blank" rel="noopener noreferrer">
            官网 ↗
          </a>
        ) : (
          <span className="muted">官网未知</span>
        )}
        {project.repo.url ? (
          <a href={project.repo.url} target="_blank" rel="noopener noreferrer">
            GitHub ↗
          </a>
        ) : (
          <span className="muted">仓库未知</span>
        )}
        <span className="muted" style={{ marginLeft: 'auto' }} title="收录日期">
          {fmtDate(project.addedAt)}
        </span>
      </div>
    </article>
  );
}

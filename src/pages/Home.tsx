import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DataGate } from '../components/DataGate';
import { Cover } from '../components/Cover';
import { useDataReady } from '../context/DataContext';
import { categoryName, featured, newArrivals, randomProject, todayPicks, weeklyHot } from '../lib/data';
import { currentIssue, issueFor } from '../lib/issue';
import { fmtDate, relativeTo } from '../lib/utils';

/**
 * Only pure-ASCII names get the display serif. A name like "LobeHub（LobeChat）"
 * mixes Latin letters with full-width brackets, and switching faces mid-word reads
 * as a bug — those keep the CJK serif for the whole line.
 */
const isLatin = (name: string) => /^[\x20-\x7E]+$/.test(name);

/** First two sentences of the summary — the cover story should read, not truncate. */
function lede(summary: string): string {
  const parts = summary.split(/(?<=。)/).filter(Boolean);
  return parts.slice(0, 2).join('') || summary;
}

function CoverStory() {
  const data = useDataReady();
  const navigate = useNavigate();
  const [picks] = useState(() => todayPicks(data, 3));
  const lead = picks[0];
  const issue = currentIssue();
  const shot = lead.screenshots[0];

  return (
    <section className="hero" aria-labelledby="cover-title">
      <div className="cover-story">
        <p className="cover-story__kicker">
          <span className="kicker">
            {issue.id} · 今日推荐
          </span>
          <span className="kicker__rule" aria-hidden="true" />
          <span className="mono" style={{ color: 'var(--ink-mute)', fontSize: '0.66rem' }}>
            第 {String(issue.number).padStart(3, '0')} 期
          </span>
        </p>

        <h1 className={`cover-story__title${isLatin(lead.name) ? ' cover-story__title--latin' : ''}`} id="cover-title">
          <Link to={`/project/${lead.slug}`}>{lead.name}</Link>
        </h1>

        <p className="cover-story__deck">{lead.tagline}</p>
        <p className="cover-story__intro">{lede(lead.summary)}</p>

        <div className="cover-story__meta">
          <span className="pill pill--accent">{categoryName(data, lead.category)}</span>
          {lead.review.mode === 'auto' ? <span className="pill pill--auto">自动收录</span> : null}
          <span>{lead.license.spdx ?? '许可证未知'}</span>
          <span className="dot">·</span>
          <span>门槛 {lead.setup.effort}</span>
          <span className="dot">·</span>
          <span>{lead.repo.pushedAt ? `更新 ${relativeTo(lead.repo.pushedAt, data.snapshotDate)}` : '更新未知'}</span>
          <span className="dot">·</span>
          <span className="mono">{issueFor(lead.slug).id}</span>
        </div>

        <div className="cover-story__actions">
          <Link className="btn btn--ink" to={`/project/${lead.slug}`}>
            读这一篇 →
          </Link>
          {lead.officialUrl ? (
            <a className="btn btn--quiet" href={lead.officialUrl} target="_blank" rel="noopener noreferrer">
              打开官网 ↗
            </a>
          ) : null}
          <button
            className="btn btn--quiet"
            type="button"
            onClick={() => {
              const pick = randomProject(data);
              navigate(`/project/${pick.slug}?via=random`);
            }}
          >
            随机发现
          </button>
        </div>
      </div>

      <figure className="hero__media">
        <Link to={`/project/${lead.slug}`} aria-label={`今日推荐：${lead.name}`}>
          <Cover
            src={shot?.card || shot?.src || null}
            alt={shot?.alt || `${lead.name} 官方页面截图`}
            name={lead.name}
            ratio="16x10"
            label={`封面 · ${issueFor(lead.slug).id}`}
            fallbackNote={shot ? undefined : '未取得可用截图'}
          />
        </Link>
        <figcaption className="hero__caption">
          <span>{shot?.origin === 'og' ? '仓库页面截图' : '官方网站截图'}</span>
          <span>{shot?.capturedAt ? `${fmtDate(shot.capturedAt)} 抓取 · 点击进入项目页` : '点击进入项目页'}</span>
        </figcaption>
      </figure>

      <aside className="hero__also" aria-label="今日另外两个推荐">
        <p className="hero__also-label">今日还有</p>
        {picks.slice(1).map((p) => (
          <Link key={p.slug} to={`/project/${p.slug}`} className="also-pick">
            <span className="also-pick__name">{p.name}</span>
            <span className="also-pick__tag">{p.tagline}</span>
            <span className="also-pick__meta">
              {categoryName(data, p.category)} · {p.setup.effort}
            </span>
          </Link>
        ))}
      </aside>

      <dl className="hero__stats">
        <div>
          <dt>收录</dt>
          <dd>{data.projects.length}</dd>
        </div>
        <div>
          <dt>分类</dt>
          <dd>{data.categories.length}</dd>
        </div>
        <div>
          <dt>数据快照</dt>
          <dd className="mono" style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
            {data.snapshotDate}
          </dd>
        </div>
        <div className="hero__stats-more">
          <Link className="btn btn--sm btn--quiet" to="/discover">
            浏览全部
          </Link>
          <Link className="btn btn--sm btn--quiet" to="/about">
            编辑原则
          </Link>
        </div>
      </dl>
    </section>
  );
}

function Section({
  num,
  title,
  note,
  more,
  children,
}: {
  num: string;
  title: string;
  note: string;
  more?: { to: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <div className="section__head">
        <div className="section__heading">
          <span className="section__num">{num}</span>
          <h2 className="section__title">{title}</h2>
        </div>
        {more ? (
          <Link className="section__more" to={more.to}>
            {more.label} ↗
          </Link>
        ) : null}
        <p className="section__note">{note}</p>
      </div>
      {children}
    </section>
  );
}

/** 最新收录 — an editorial index: thumbnail, name, one line, one metadata row. */
function IndexRow({ project, badge }: { project: ReturnType<typeof newArrivals>[number]; badge?: string }) {
  const data = useDataReady();
  const shot = project.screenshots[0];
  return (
    <article className="index-row">
      <Link to={`/project/${project.slug}`} className="index-row__thumb" aria-label={`查看 ${project.name}`}>
        <Cover src={shot?.card || shot?.src || null} alt={shot?.alt || project.name} name={project.name} ratio="4x3" label={badge} fallbackNote={shot ? undefined : '未取得截图'} />
      </Link>

      <h3 className="index-row__name">
        <Link to={`/project/${project.slug}`}>{project.name}</Link>
        {project.review.mode === 'auto' ? (
          <span className="pill pill--auto" title="自动流水线收录，中文文案未经人工校对">
            自动
          </span>
        ) : null}
      </h3>
      <p className="index-row__tag">{project.tagline}</p>

      <p className="index-row__meta">
        <span>{categoryName(data, project.category)}</span>
        <span className="dot">·</span>
        <span>{project.license.spdx ?? '许可证未知'}</span>
        <span className="dot">·</span>
        <span>{project.repo.pushedAt ? `更新 ${relativeTo(project.repo.pushedAt, data.snapshotDate)}` : '更新未知'}</span>
        <span className="dot">·</span>
        <span>{project.setup.effort}</span>
      </p>

      <p className="index-row__links">
        <Link to={`/project/${project.slug}`}>详情 →</Link>
        {project.officialUrl ? (
          <a href={project.officialUrl} target="_blank" rel="noopener noreferrer">
            官网 ↗
          </a>
        ) : null}
        {project.repo.url ? (
          <a href={project.repo.url} target="_blank" rel="noopener noreferrer">
            GitHub ↗
          </a>
        ) : null}
        <span className="index-row__date">{fmtDate(project.addedAt)} 收录</span>
      </p>
    </article>
  );
}

function HomeInner() {
  const data = useDataReady();
  const editors = featured(data, 3);
  const fresh = newArrivals(data, 6);
  const hot = weeklyHot(data, 6);

  return (
    <>
      <div className="standfirst">
        <span className="standfirst__note">一本每天更新的独立数字杂志，专门发现值得使用的开源项目与互联网工具。</span>
        <span>
          收录 {data.projects.length} · 分类 {data.categories.length} · 快照 {data.snapshotDate}
        </span>
      </div>

      <CoverStory />

      <Section num="01" title="最新收录" note="按进入清单的时间排列。新不代表好，只是我们刚刚读到它。" more={{ to: '/discover?sort=newest', label: '全部项目' }}>
        <div className="index-list">
          {fresh.map((p) => (
            <IndexRow key={p.slug} project={p} badge={`NEW ${fmtDate(p.addedAt)}`} />
          ))}
        </div>
      </Section>

      <Section
        num="02"
        title="本周热门"
        note="站内没有埋点。排名只由两件公开数据决定：仓库 Star 规模与最近推送时间，算法写在 scripts/build-data.mjs 里，可复核。"
        more={{ to: '/discover?sort=updated', label: '按更新排序' }}
      >
        <ol className="chart">
          {hot.map((p, i) => (
            <li key={p.slug} className="chart__row">
              <span className="chart__rank" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="chart__main">
                <p className="chart__name">
                  <Link to={`/project/${p.slug}`}>
                    <span className="visually-hidden">第 {i + 1} 名：</span>
                    {p.name}
                  </Link>
                </p>
                <p className="chart__tag">{p.tagline}</p>
              </div>
              <span className="chart__stars" title="GitHub Star（快照数据，非周增量）">
                {p.repo.stars === null ? '★ 未知' : `★ ${p.repo.stars.toLocaleString('en-US')}`}
              </span>
              <span className="chart__cat">{categoryName(data, p.category)}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section num="03" title="编辑精选" note="不是最热的，是我们自己会一直开着的三个。每条后面是编辑当时写下的理由。" more={{ to: '/about#how', label: '怎么选的' }}>
        <div className="picks">
          {editors.map((p, i) => (
            <article key={p.slug} className={`pick${i === 0 ? ' pick--lead' : ''}`}>
              <Link to={`/project/${p.slug}`} aria-label={p.name}>
                <Cover
                  src={p.screenshots[0]?.card || p.screenshots[0]?.src || null}
                  alt={p.screenshots[0]?.alt || p.name}
                  name={p.name}
                  ratio={i === 0 ? '4x3' : '16x10'}
                />
              </Link>
              <div className="pick__body">
                <p className="pick__label">编辑备注 · {String(i + 1).padStart(2, '0')}</p>
                <h3 className="pick__title">
                  <Link to={`/project/${p.slug}`}>{p.name}</Link>
                </h3>
                <p className="pick__note">{p.editorsNote || p.tagline}</p>
                <p className="pick__meta">
                  {p.license.spdx ?? '许可证未知'} · {p.setup.effort} · {p.audience}
                </p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section num="04" title="分类入口" note="十个抽屉，东西都按用途分好了。" more={{ to: '/categories', label: '分类索引' }}>
        <div className="sections-index">
          {data.categories.map((c, index) => {
            const items = data.projects.filter((p) => p.category === c.id);
            return (
              <Link key={c.id} to={`/category/${c.id}`} className="section-link">
                <span className="section-link__num">{String(index + 1).padStart(2, '0')}</span>
                <span className="section-link__name">{c.name}</span>
                <span className="section-link__en">{c.english}</span>
                <span className="section-link__blurb">{c.blurb}</span>
                <span className="section-link__count">{String(items.length).padStart(2, '0')}</span>
              </Link>
            );
          })}
        </div>
      </Section>
    </>
  );
}

export function HomePage() {
  return (
    <DataGate>
      <HomeInner />
    </DataGate>
  );
}

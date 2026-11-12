import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DataGate } from '../components/DataGate';
import { Cover } from '../components/Cover';
import { useDataReady } from '../context/DataContext';
import {
  boardCoverage,
  boardNote,
  boardValue,
  categoryName,
  feedEvents,
  feedKindLabel,
  featured,
  newArrivals,
  randomProject,
  rankProjects,
  todayPicks,
  type BoardId,
} from '../lib/data';
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
        <div className="cover-story__flags">
          <span className="sticker">今日推荐 · {issue.id}</span>
          <span className="sticker sticker--muted">第 {String(issue.number).padStart(3, '0')} 期</span>
          {lead.review.mode === 'auto' ? <span className="sticker sticker--electric">自动收录</span> : null}
        </div>

        <h1 className={`cover-story__title${isLatin(lead.name) ? ' cover-story__title--latin' : ''}`} id="cover-title">
          <Link to={`/project/${lead.slug}`}>{lead.name}</Link>
        </h1>

        <p className="cover-story__deck">{lead.tagline}</p>
        <p className="cover-story__intro">{lede(lead.summary)}</p>

        <div className="cover-story__meta">
          <span className="pill pill--accent">{categoryName(data, lead.category)}</span>
          <span>{lead.license.spdx ?? '许可证未知'}</span>
          <span>门槛 {lead.setup.effort}</span>
          <span>{lead.repo.pushedAt ? `更新 ${relativeTo(lead.repo.pushedAt, data.snapshotDate)}` : '更新未知'}</span>
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
        <div className="sticker-cluster" aria-hidden="true">
          <span className="sticker">LIVE CAPTURE</span>
        </div>
        <div className="frame">
          <div className="frame__bar" aria-hidden="true">
            <span className="frame__dot" />
            <span className="frame__dot" />
            <span className="frame__dot" />
            <span className="frame__url">{lead.officialUrl?.replace(/^https?:\/\//, '') || lead.repo.fullName}</span>
          </div>
          <Link to={`/project/${lead.slug}`} aria-label={`今日推荐：${lead.name}`}>
            <Cover
              src={shot?.card || shot?.src || null}
              alt={shot?.alt || `${lead.name} 官方页面截图`}
              name={lead.name}
              ratio="16x10"
              fallbackNote={shot ? undefined : '未取得可用截图'}
            />
          </Link>
        </div>
        <figcaption className="hero__caption">
          <span>{shot?.origin === 'og' ? '仓库页面截图' : '官方网站截图'}</span>
          <span>{shot?.capturedAt ? `${fmtDate(shot.capturedAt)} 抓取 · 点击进入项目页` : '点击进入项目页'}</span>
        </figcaption>
      </figure>

      <aside className="hero__also" aria-label="今日另外两个推荐">
        <p className="hero__also-label">今日还有 / ALSO TODAY</p>
        {picks.slice(1).map((p) => (
          <Link key={p.slug} to={`/project/${p.slug}`} className="also-pick">
            <span>
              <span className="also-pick__name">{p.name}</span>
              <span className="also-pick__tag">{p.tagline}</span>
            </span>
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
          <dd className="mono">{data.snapshotDate}</dd>
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

/** The marquee under the cover: facts, not decoration. */
function Ticker() {
  const data = useDataReady();
  const issue = currentIssue();
  const hot = rankProjects(data, 'week', 3);
  const items = [
    `第 ${String(issue.number).padStart(3, '0')} 期`,
    `收录 ${data.projects.length} 个项目`,
    `${data.categories.length} 个分类`,
    `自动收录 ${data.projects.filter((p) => p.review.mode === 'auto').length} 个`,
    `本周热门 ${hot.map((p) => p.name).join(' · ')}`,
    `数据快照 ${data.snapshotDate}`,
    '未知就是未知',
    '不伪造 Star 与评分',
  ];
  const track = [...items, ...items];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker__track">
        {track.map((item, i) => (
          <span className="ticker__item" key={`${item}-${i}`}>
            <b>✦</b>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Three live boards side by side + the newest real events. */
function BoardsAndEvents() {
  const data = useDataReady();
  const boards: Array<{ id: BoardId; label: string }> = [
    { id: 'today', label: '今日有推送' },
    { id: 'week', label: '本周热榜' },
    { id: 'month', label: '本月热榜' },
  ];
  const events = feedEvents(data, 6);

  return (
    <>
      <Section
        num="02"
        title="今天该看什么"
        note="三个榜单，全部由仓库自己的提交数排出，发版情况单独标注。没有埋点，也没有编辑偏好——每个数字都能回仓库核对。"
        more={{ to: '/rankings', label: '完整榜单' }}
      >
        <div className="boardstrip">
          {boards.map((b) => {
            const top = rankProjects(data, b.id, 1)[0];
            const coverage = boardCoverage(data, b.id);
            if (!top) {
              return (
                <div key={b.id} className="boardtile">
                  <span className="boardtile__label">{b.label}</span>
                  <p className="boardtile__note">今天还没有满足条件的项目</p>
                </div>
              );
            }
            return (
              <article key={b.id} className="boardtile">
                <span className="boardtile__label">{b.label}</span>
                <p className="boardtile__name">
                  <Link to={`/project/${top.slug}`}>{top.name}</Link>
                </p>
                <p className="boardtile__value">
                  {boardValue(top, b.id)} · 共 {coverage} 个有数据
                </p>
                <p className="boardtile__note">{boardNote(top, data.snapshotDate)}</p>
              </article>
            );
          })}
        </div>

        <div className="eventstrip">
          {events.map((e, i) => (
            <div key={`${e.project.slug}-${e.kind}-${i}`} className="eventstrip__row">
              <span className={`eventstrip__kind eventstrip__kind--${e.kind}`}>
                {feedKindLabel(e.kind)}
              </span>
              <Link to={`/project/${e.project.slug}`} className="eventstrip__name">
                {e.project.name}
              </Link>
              <span className="eventstrip__label">{e.label}</span>
              <span className="eventstrip__when">{relativeTo(e.at, data.snapshotDate)}</span>
            </div>
          ))}
        </div>
      </Section>
    </>
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

/** 最新收录 — an editorial index: number, name, one line, one metadata row. */
function IndexRow({ project, index, badge }: { project: ReturnType<typeof newArrivals>[number]; index: number; badge?: string }) {
  const data = useDataReady();
  const shot = project.screenshots[0];
  return (
    <article className="index-row">
      <span className="index-row__num" aria-hidden="true">
        {String(index + 1).padStart(2, '0')}
      </span>
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
  const hot = rankProjects(data, 'week', 6);

  return (
    <>
      <CoverStory />
      <Ticker />

      <BoardsAndEvents />

      <Section num="03" title="最新收录" note="按进入清单的时间排列。新不代表好，只是我们刚刚读到它。" more={{ to: '/discover?sort=newest', label: '全部项目' }}>
        <div className="index-list">
          {fresh.map((p, i) => (
            <IndexRow key={p.slug} project={p} index={i} badge={`NEW ${fmtDate(p.addedAt)}`} />
          ))}
        </div>
      </Section>

      <Section
        num="04"
        title="本周热榜"
        note="最近 7 天的提交数 + 7 天内是否发版。两个数都来自 GitHub 仓库统计，不是我们的估算，也没有埋点。"
        more={{ to: '/rankings?board=week', label: '完整榜单' }}
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
              <span className="chart__stars" title="本周提交数">
                {boardValue(p, 'week')}
              </span>
              <span className="chart__cat">{boardNote(p, data.snapshotDate)}</span>
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

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DataGate } from '../components/DataGate';
import { Cover } from '../components/Cover';
import { ProjectCard } from '../components/ProjectCard';
import { useDataReady } from '../context/DataContext';
import { categoryName, featured, newArrivals, randomProject, todayPicks, weeklyHot } from '../lib/data';
import { currentIssue, issueFor } from '../lib/issue';
import { fmtDate, relativeTo } from '../lib/utils';

function HeroLead() {
  const data = useDataReady();
  const navigate = useNavigate();
  const [picks] = useState(() => todayPicks(data, 3));
  const lead = picks[0];
  const issue = currentIssue();
  const shot = lead.screenshots[0];
  const published = data.projects.length;

  return (
    <section className="hero">
      <div className="hero__left">
        <p className="hero__kicker">
          <span className="mono">{issue.id}</span>
          <span className="hero__kicker-line" />
          <span>今日推荐</span>
        </p>
        <h1 className="hero__title">
          今天又有
          <br />
          什么<span className="hero__title-accent">新玩具</span>？
        </h1>
        <p className="hero__dek">
          一份由人写的开源项目与互联网工具清单。每一条都有中文介绍、真实截图、明确的许可证与上手门槛；
          取不到的数字，我们写「未知」，不编。
        </p>

        <div className="hero__actions">
          <button className="btn btn--accent" type="button" onClick={() => navigate(`/project/${lead.slug}`)}>
            看看今天的 {lead.name} →
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => {
              const pick = randomProject(data);
              navigate(`/project/${pick.slug}?via=random`);
            }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            随机发现
          </button>
        </div>

        <dl className="hero__stats">
          <div>
            <dt>收录</dt>
            <dd className="mono">{published}</dd>
          </div>
          <div>
            <dt>分类</dt>
            <dd className="mono">{data.categories.length}</dd>
          </div>
          <div>
            <dt>数据快照</dt>
            <dd className="mono">{data.snapshotDate}</dd>
          </div>
        </dl>
      </div>

      <div className="hero__right">
        <Link to={`/project/${lead.slug}`} className="hero__cover" aria-label={`今日推荐：${lead.name}`}>
          <Cover
            src={shot?.src || null}
            alt={shot?.alt || `${lead.name} 官方页面截图`}
            name={lead.name}
            ratio="4x3"
            label={`TODAY · ${issueFor(lead.slug).id}`}
            fallbackNote={shot ? undefined : '未取得可用截图'}
          />
        </Link>
        <div className="hero__caption">
          <div className="hero__caption-main">
            <p className="hero__caption-name">
              <Link to={`/project/${lead.slug}`}>{lead.name}</Link>
            </p>
            <p className="hero__caption-line">{lead.tagline}</p>
          </div>
          <div className="hero__caption-meta">
            <span className="pill pill--accent">{categoryName(data, lead.category)}</span>
            <span className="mono">{lead.license.spdx ?? '许可证未知'}</span>
            <span className="dot">·</span>
            <span className="mono">
              {lead.repo.pushedAt ? `更新 ${relativeTo(lead.repo.pushedAt, data.snapshotDate)}` : '更新未知'}
            </span>
          </div>
        </div>

        <div className="hero__side-picks">
          {picks.slice(1).map((p) => (
            <Link key={p.slug} to={`/project/${p.slug}`} className="side-pick">
              <span className="side-pick__name">{p.name}</span>
              <span className="side-pick__tag">{p.tagline}</span>
              <span className="side-pick__meta mono">
                {categoryName(data, p.category)} · {p.setup.effort}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Section({
  num,
  title,
  desc,
  more,
  children,
}: {
  num: string;
  title: string;
  desc: string;
  more?: { to: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <div className="section__head">
        <div>
          <h2 className="section__title">
            <span className="section__num">{num}</span>
            {title}
          </h2>
          <p className="section__desc" style={{ marginTop: '0.35rem' }}>
            {desc}
          </p>
        </div>
        {more ? (
          <Link className="section__more" to={more.to}>
            {more.label} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function HomeInner() {
  const data = useDataReady();
  const editors = featured(data, 3);
  const fresh = newArrivals(data, 6);
  const hot = weeklyHot(data, 6);

  return (
    <>
      <HeroLead />

      <Section
        num="01"
        title="最新收录"
        desc="按进入清单的时间排列。新不代表好，只是我们刚刚读到它。"
        more={{ to: '/discover?sort=newest', label: '查看全部' }}
      >
        <div className="grid grid--3">
          {fresh.map((p) => (
            <ProjectCard key={p.slug} project={p} badge={`NEW · ${fmtDate(p.addedAt)}`} />
          ))}
        </div>
      </Section>

      <Section
        num="02"
        title="本周热门"
        desc="站内没有埋点，所以这里的热门＝仓库 Star 规模 + 最近推送时间，算法只有这两项，公开可复核。"
        more={{ to: '/discover?sort=updated', label: '按更新排序' }}
      >
        <ol className="hotlist">
          {hot.map((p, i) => (
            <li key={p.slug} className="hotlist__row">
              <span className="hotlist__rank mono">{String(i + 1).padStart(2, '0')}</span>
              <div className="hotlist__main">
                <Link to={`/project/${p.slug}`} className="hotlist__name">
                  {p.name}
                </Link>
                <p className="hotlist__tag">{p.tagline}</p>
              </div>
              <div className="hotlist__meta">
                <span className="mono">{p.repo.stars === null ? '★ 未知' : `★ ${p.repo.stars.toLocaleString('en-US')}`}</span>
                <span className="hotlist__cat">{categoryName(data, p.category)}</span>
              </div>
              <span className="hotlist__effort mono">{p.setup.effort}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section num="03" title="编辑精选" desc="不是最热的，是我们自己会一直开着的三个。" more={{ to: '/about#how', label: '怎么选的' }}>
        <div className="editors">
          {editors.map((p, i) => (
            <article key={p.slug} className={`editor editor--${i}`}>
              <Link to={`/project/${p.slug}`} aria-label={p.name}>
                <Cover src={p.screenshots[0]?.card || null} alt={p.screenshots[0]?.alt || p.name} name={p.name} ratio={i === 0 ? '4x3' : '16x10'} />
              </Link>
              <div className="editor__body">
                <p className="eyebrow">编辑备注</p>
                <h3 className="editor__title">
                  <Link to={`/project/${p.slug}`}>{p.name}</Link>
                </h3>
                <p className="editor__note">{p.editorsNote || p.tagline}</p>
                <p className="editor__meta">
                  {p.license.spdx ?? '许可证未知'} · {p.setup.effort} · {p.audience}
                </p>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section num="04" title="分类入口" desc="十个抽屉，东西都按用途分好了。" more={{ to: '/categories', label: '分类索引' }}>
        <div className="catgrid">
          {data.categories.map((c) => {
            const items = data.projects.filter((p) => p.category === c.id);
            return (
              <Link key={c.id} to={`/category/${c.id}`} className="catgrid__item">
                <span className="catgrid__name">{c.name}</span>
                <span className="catgrid__en mono">{c.english}</span>
                <span className="catgrid__blurb">{c.blurb}</span>
                <span className="catgrid__count mono">{String(items.length).padStart(2, '0')}</span>
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

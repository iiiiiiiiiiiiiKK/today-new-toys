import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { DataGate, useSeo } from '../components/DataGate';
import { Cover } from '../components/Cover';
import { FavButton } from '../components/ProjectCard';
import { ShareDialog } from '../components/ShareDialog';
import { RevisionDialog } from '../components/RevisionDialog';
import { useDataReady } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { copyToClipboard, projectUrl, shareText } from '../lib/share';
import { categoryName, activityLevel, similar, statusLabel } from '../lib/data';
import { issueFor } from '../lib/issue';
import { assetUrl } from '../lib/asset';
import { fmtDate, relativeTo } from '../lib/utils';
import { NotFoundPage } from './NotFound';

export function ProjectPage() {
  return (
    <DataGate label="正在读这一页的介绍…">
      <ProjectInner />
    </DataGate>
  );
}

function Field({ label, children, unknown }: { label: string; children: React.ReactNode; unknown?: boolean }) {
  return (
    <div className={`field ${unknown ? 'field--unknown' : ''}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ProjectInner() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const data = useDataReady();
  const project = data.projects.find((p) => p.slug === slug);
  const [shareOpen, setShareOpen] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const { show } = useToast();
  const issue = useMemo(() => (project ? issueFor(project.slug) : null), [project]);

  useSeo({
    title: project ? `${project.name} · 今天又有什么新玩具` : '项目未找到 · 今天又有什么新玩具',
    description: project ? `${project.tagline}｜${project.summary.slice(0, 90)}` : undefined,
    image: assetUrl(project?.screenshots[0]?.src) ?? undefined,
  });

  if (!project) return <NotFoundPage kind="项目" />;

  const shot = project.screenshots[0];
  const others = similar(data, project, 3);
  const cat = categoryName(data, project.category);
  const viaRandom = params.get('via') === 'random';
  const repoWarn = project.repo.warnings ?? [];

  return (
    <article className="project">
      <nav className="breadcrumb mono" aria-label="面包屑">
        <Link to="/">首页</Link>
        <span>/</span>
        <Link to="/discover">全部项目</Link>
        <span>/</span>
        <Link to={`/category/${project.category}`}>{cat}</Link>
        <span>/</span>
        <span aria-current="page">{project.name}</span>
      </nav>

      {viaRandom ? (
        <p className="random-note">
          <span className="mono">RANDOM</span> 你是被随机丢进来的。这一页讲的是 {project.name}。
        </p>
      ) : null}

      <header className="project__head">
        <div className="project__headmain">
          <p className="project__kicker">
            <span className="mono">{issue?.label}</span>
            <span className="dot">·</span>
            <span>{cat}</span>
          </p>
          <h1 className="project__title">{project.name}</h1>
          <p className="project__tagline">{project.tagline}</p>
          <p className="project__summary">{project.summary}</p>

          <div className="project__actions">
            <FavButton slug={project.slug} name={project.name} withLabel />
            <button
              className="btn btn--sm"
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(projectUrl(project.slug));
                show(ok ? '项目链接已复制' : '复制失败', ok ? 'ok' : 'warn');
              }}
            >
              复制链接
            </button>
            <button
              className="btn btn--sm"
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(shareText(project));
                show(ok ? '中文分享文案已复制' : '复制失败', ok ? 'ok' : 'warn');
              }}
            >
              复制分享文案
            </button>
            <button className="btn btn--sm btn--accent" type="button" onClick={() => setShareOpen(true)}>
              生成分享图
            </button>
            {project.officialUrl ? (
              <a className="btn btn--sm btn--ghost" href={project.officialUrl} target="_blank" rel="noopener noreferrer">
                打开官网 ↗
              </a>
            ) : null}
            {project.repo.url ? (
              <a className="btn btn--sm btn--ghost" href={project.repo.url} target="_blank" rel="noopener noreferrer">
                GitHub ↗
              </a>
            ) : null}
          </div>
        </div>

        <aside className="project__facts" aria-label="关键信息">
          <dl>
            <Field label="分类">
              <Link to={`/category/${project.category}`}>{cat}</Link>
            </Field>
            <Field label="适用人群">{project.audience}</Field>
            <Field label="体验门槛">
              {project.setup.effort}
              <span className="field__note">{project.setup.effortNote}</span>
            </Field>
            <Field label="开源许可证" unknown={!project.license.spdx}>
              {project.license.spdx ? (
                <>
                  {project.license.name || project.license.spdx}
                  <span className="field__code mono">{project.license.spdx}</span>
                  {project.license.note ? <span className="field__note">{project.license.note}</span> : null}
                  {project.license.url ? (
                    <a className="field__link" href={project.license.url} target="_blank" rel="noopener noreferrer">
                      许可原文 ↗
                    </a>
                  ) : null}
                </>
              ) : (
                <>
                  未知
                  <span className="field__note">{project.license.note || '仓库未声明可识别的许可证'}</span>
                </>
              )}
            </Field>
            <Field label="Star 数" unknown={project.repo.stars === null}>
              {project.repo.stars === null ? (
                <>
                  未知
                  <span className="field__note">本次快照未取到，未做估算</span>
                </>
              ) : (
                <>
                  <span className="mono">{project.repo.stars.toLocaleString('en-US')}</span>
                  <span className="field__note">来自 GitHub API 快照 {fmtDate(project.repo.fetchedAt)}，会随时间变化</span>
                </>
              )}
            </Field>
            <Field label="仓库活跃度" unknown={!project.repo.pushedAt}>
              {statusLabel(activityLevel(project, data.snapshotDate))}
              <span className="field__note">
                {project.repo.pushedAt ? `最近推送 ${fmtDate(project.repo.pushedAt)}（${relativeTo(project.repo.pushedAt, data.snapshotDate)}）` : '未取到最近推送时间'}
              </span>
            </Field>
            <Field label="收录日期">{fmtDate(project.addedAt)}</Field>
            <Field label="技术栈" unknown={!project.repo.language}>
              {project.repo.language || '未知'}
              {project.repo.topics.length ? <span className="field__note">Topics：{project.repo.topics.slice(0, 6).join('、')}</span> : null}
            </Field>
          </dl>
        </aside>
      </header>

      <section className="project__shots" id="shots">
        <div className="project__shots-head">
          <h2 className="prose__h2">项目截图</h2>
          <p className="mono">FIG. 01{shot ? ` · ${shot.origin === 'og' ? 'REPO PREVIEW' : 'LIVE CAPTURE'}` : ''}</p>
        </div>
        <figure className="project__shot">
          <Cover src={shot?.src || null} alt={shot?.alt || `${project.name} 官方页面`} name={project.name} ratio="16x10" label={shot?.origin === 'og' ? 'REPO PREVIEW' : shot ? 'LIVE CAPTURE' : undefined} labelTone="muted" />
          <figcaption>
            {shot ? (
              <>
                {shot.credit || `截图：${project.officialUrl || project.repo.url}`}
                {shot.capturedAt ? ` · ${fmtDate(shot.capturedAt)} 抓取` : ''}
              </>
            ) : (
              <>未取得该项目的可用截图，此处显示的是标注过的占位图，不是产品界面。</>
            )}
          </figcaption>
        </figure>
      </section>

      <div className="project__body">
        <section className="prose" id="overview">
          <h2>项目概览</h2>
          <p>{project.summary}</p>
          <div className="basis">
            <p className="basis__label mono">内容依据</p>
            <p>{project.contentBasis}</p>
            <p className="basis__meta mono">
              README：{project.readme.path ? `${project.readme.path} · ${project.readme.chars.toLocaleString('en-US')} 字` : '未读取'}
              {project.readme.fetchedAt ? ` · ${fmtDate(project.readme.fetchedAt)} 抓取` : ''}
            </p>
          </div>
          {project.readme.headings.length ? (
            <details className="readme-outline">
              <summary>README 中出现的章节（{project.readme.headings.length}）</summary>
              <ul>
                {project.readme.headings.slice(0, 14).map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
              <p className="readme-outline__note">这些是小标题原文，用来核对上面的介绍是否有依据；不是我们写的功能列表。</p>
            </details>
          ) : null}
        </section>

        <section className="prose" id="features">
          <h2>主要功能</h2>
          <ol className="features">
            {project.features.map((f) => (
              <li key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="prose" id="audience">
          <h2>适合谁使用</h2>
          <ul className="checklist">
            {project.audienceFor.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="prose__muted">反过来：如果你只是想要一个现成的成品、不想读文档或配置环境，这个项目可能不适合你。</p>
        </section>

        <section className="prose" id="setup">
          <h2>使用方式</h2>
          <p className="prose__lead">
            <strong>{project.setup.effort}</strong> —— {project.setup.effortNote}
          </p>
          {project.setup.requires.length ? (
            <p className="prose__muted">
              <span className="mono">需要</span>：{project.setup.requires.join('、')}
            </p>
          ) : null}
          <ol className="steps">
            {project.setup.steps.map((s, i) => (
              <li key={s.title}>
                <span className="steps__n mono">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="prose__muted">
            <span className="mono">成本</span>：{project.setup.cost}
          </p>
        </section>

        <section className="prose" id="stack">
          <h2>技术栈与许可证</h2>
          <table className="spectable">
            <tbody>
              <tr>
                <th scope="row">主要语言</th>
                <td>{project.repo.language || '未知'}</td>
              </tr>
              <tr>
                <th scope="row">Topics</th>
                <td>{project.repo.topics.length ? project.repo.topics.join('、') : '未知（仓库未设置 Topics）'}</td>
              </tr>
              <tr>
                <th scope="row">许可证</th>
                <td>{project.license.spdx ? `${project.license.name || project.license.spdx}（${project.license.spdx}）` : `未知 —— ${project.license.note || '未声明'}`}</td>
              </tr>
              <tr>
                <th scope="row">版权与署名</th>
                <td>代码与文档版权归项目作者所有；本站仅摘录公开 README 内容并注明来源，不声称任何所有权。</td>
              </tr>
              <tr>
                <th scope="row">仓库</th>
                <td>
                  {project.repo.url ? (
                    <a href={project.repo.url} target="_blank" rel="noopener noreferrer">
                      {project.repo.fullName} ↗
                    </a>
                  ) : (
                    '未知'
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="prose" id="links">
          <h2>官方仓库及演示链接</h2>
          <ul className="links-list">
            <li>
              <span className="mono">OFFICIAL</span>
              {project.officialUrl ? (
                <a href={project.officialUrl} target="_blank" rel="noopener noreferrer">
                  {project.officialUrl} ↗
                </a>
              ) : (
                <span className="unknown">未知 —— 项目未提供独立官网</span>
              )}
            </li>
            <li>
              <span className="mono">REPO</span>
              {project.repo.url ? (
                <a href={project.repo.url} target="_blank" rel="noopener noreferrer">
                  {project.repo.url} ↗
                </a>
              ) : (
                <span className="unknown">未知</span>
              )}
            </li>
            <li>
              <span className="mono">DEMO</span>
              {project.demoUrl ? (
                <a href={project.demoUrl} target="_blank" rel="noopener noreferrer">
                  {project.demoUrl} ↗
                </a>
              ) : (
                <span className="unknown">未知 —— 未取得公开演示地址</span>
              )}
            </li>
          </ul>
          <p className="prose__muted">
            链接检查：{project.linkStatus === 'ok' ? '已人工核验可访问' : project.linkStatus === 'dead' ? '已标记为可能失效' : '尚未核验'}
            {project.linkCheckedAt ? `（${project.linkCheckedAt}）` : ''}。外部链接均在新标签页打开，并带 noopener。
          </p>
          {repoWarn.length ? (
            <p className="prose__muted">
              <span className="mono">数据提示</span>：{repoWarn.join('；')}
            </p>
          ) : null}
        </section>
      </div>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">
            <span className="section__num">→</span>
            同类推荐
          </h2>
          <p className="section__desc">按分类、标签和适用人群的相似度挑的，不是广告位。</p>
        </div>
        <div className="similar">
          {others.map((p) => (
            <Link key={p.slug} to={`/project/${p.slug}`} className="similar__item">
              <span className="similar__cat mono">{categoryName(data, p.category)}</span>
              <span className="similar__name">{p.name}</span>
              <span className="similar__tag">{p.tagline}</span>
              <span className="similar__meta mono">
                {p.setup.effort} · {p.license.spdx ?? '许可证未知'}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="project__foot">
        <p className="mono">
          {issue?.id} · 收录于 {fmtDate(project.addedAt)} · 最近审校 {project.review.reviewedAt ? fmtDate(project.review.reviewedAt) : '未知'}
        </p>
        <p>
          发现信息有误？{' '}
          <button type="button" className="linklike project__fix" onClick={() => setReviseOpen(true)}>
            提交修订
          </button>
          ，或按 README 的「内容维护」流程提交修正。
        </p>
      </footer>

      {shareOpen ? <ShareDialog project={project} onClose={() => setShareOpen(false)} /> : null}
      {reviseOpen ? <RevisionDialog project={project} onClose={() => setReviseOpen(false)} /> : null}
    </article>
  );
}

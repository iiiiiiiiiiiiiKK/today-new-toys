import { Link, useSearchParams } from 'react-router-dom';
import { DataGate } from '../components/DataGate';
import { Cover } from '../components/Cover';
import { useDataReady } from '../context/DataContext';
import {
  BOARDS,
  boardCoverage,
  boardNote,
  boardValue,
  feedEvents,
  historyDepth,
  rankProjects,
  type BoardId,
} from '../lib/data';
import { fmtDate } from '../lib/utils';

const X_URL = 'https://x.com/0xkillcoin';

function updatedLabel(iso: string | null | undefined, snapshotDate: string): string {
  if (!iso) return '时间未知';
  const diff = endOfDay(snapshotDate) - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return fmtDate(iso);
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return '刚刚';
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '昨天' : `${days} 天前`;
}

function endOfDay(day: string): number {
  return new Date(`${day}T23:59:59Z`).getTime();
}

function BoardPage() {
  const data = useDataReady();
  const [params, setParams] = useSearchParams();
  const requested = params.get('board') as BoardId | null;
  const active: BoardId = BOARDS.some((b) => b.id === requested) ? (requested as BoardId) : 'today';
  const board = BOARDS.find((b) => b.id === active)!;

  const rows = rankProjects(data, active, 30);
  const coverage = boardCoverage(data, active);
  const depth = historyDepth(data);
  const events = feedEvents(data, 12);

  return (
    <div className="boardpage">
      <header className="pagehead">
        <p className="pagehead__label">
          <span className="eyebrow">RANKINGS / 榜单</span>
          <span className="mono pagehead__count">
            {coverage} / {data.projects.length} 有数据
          </span>
        </p>
        <div className="pagehead__row">
          <h1 className="pagehead__title">{board.name}</h1>
          <p className="pagehead__lede">{board.method}</p>
        </div>
        {active === 'rising' ? (
          <p className="board-honest">
            {depth.enough
              ? `涨幅来自本站自己记录的 Star 快照，当前最长窗口 ${depth.days} 天。窗口不足 30 天的项目会标出实际天数，不假装是月增。`
              : `本站从 ${data.snapshotDate} 开始每天记录 Star 总数。第一个快照只能作为基准，所以涨幅要等下一次快照才会出现——现在这块是空的，不是 0。`}
          </p>
        ) : null}
      </header>

      <nav className="boardtabs" aria-label="榜单切换">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`boardtab${b.id === active ? ' is-on' : ''}`}
            aria-pressed={b.id === active}
            onClick={() => setParams({ board: b.id }, { replace: true })}
          >
            {b.name}
            <span className="boardtab__n mono">{boardCoverage(data, b.id)}</span>
          </button>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="empty">
          <p className="empty__title">这个榜单今天还没有数据</p>
          <p>
            {active === 'rising'
              ? '星标涨幅需要两次相隔足够久的 Star 快照。等下一次自动更新跑完，这里就会有真实数字。'
              : '没有任何项目满足这个榜单的收录条件。换一个榜单，或者看下面的「刚刚发生」。'}
          </p>
        </div>
      ) : (
        <ol className="boardlist">
          {rows.map((p, i) => (
            <li key={p.slug} className="boardrow">
              <span className={`boardrow__rank${i < 3 ? ' is-top' : ''}`} aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <Link to={`/project/${p.slug}`} className="boardrow__thumb" aria-label={p.name}>
                <Cover
                  src={p.screenshots[0]?.card || p.screenshots[0]?.src || null}
                  alt={p.screenshots[0]?.alt || p.name}
                  name={p.name}
                  ratio="16x10"
                />
              </Link>
              <div className="boardrow__main">
                <h2 className="boardrow__name">
                  <Link to={`/project/${p.slug}`}>{p.name}</Link>
                  {p.review.mode === 'auto' ? (
                    <span className="pill pill--auto" title="自动收录，中文文案未经人工校对">
                      自动
                    </span>
                  ) : null}
                </h2>
                <p className="boardrow__tag">{p.tagline}</p>
                <p className="boardrow__note">{boardNote(p, data.snapshotDate)}</p>
              </div>
              <div className="boardrow__side">
                <span className="boardrow__value mono" title={board.unit}>
                  {boardValue(p, active)}
                </span>
                <span className="boardrow__unit mono">{board.unit}</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      <section className="boardfoot">
        <h2 className="boardfoot__title">榜单是怎么算的</h2>
        <ul className="boardfoot__list">
          <li>
            <b>提交数</b>来自 GitHub 的 <code>stats/participation</code>，是仓库自己统计的分周提交数，不是我们的估算。
          </li>
          <li>
            <b>发版</b>来自 <code>releases</code>，只有带日期的正式版本才算加权，预发布版本只显示不排序。
          </li>
          <li>
            <b>Star 涨幅</b>来自本站每天一次的 Star 快照。GitHub 不提供按天的 Star 明细，
            所以这个数字只能由我们自己累积；没有两天数据就没有涨幅。
          </li>
          <li>
            <b>Star 总量</b>是存量。它属于「最大的项目」，不属于「今天最热的项目」。
          </li>
        </ul>
      </section>

      <section className="boardfeed">
        <h2 className="boardfoot__title">刚刚发生</h2>
        <ul className="feedlist">
          {events.map((e, i) => (
            <li key={`${e.project.slug}-${e.kind}-${i}`} className="feedrow">
              <span className={`feedrow__kind feedrow__kind--${e.kind} mono`}>
                {e.kind === 'release' ? '发版' : e.kind === 'commit' ? '推送' : '收录'}
              </span>
              <Link to={`/project/${e.project.slug}`} className="feedrow__name">
                {e.project.name}
              </Link>
              <span className="feedrow__label">{e.label}</span>
              <span className="feedrow__when mono">{updatedLabel(e.at, data.snapshotDate)}</span>
            </li>
          ))}
        </ul>
        <p className="boardfeed__note">
          全部事件都有真实时间戳。抓取时间表见{' '}
          <Link to="/about#data">数据说明</Link>；最新一次快照 {fmtDate(data.snapshotDate)}。
        </p>
      </section>

      <p className="boardcontact">
        想看别的维度，或者觉得某个项目排错了？<a href={X_URL} target="_blank" rel="noopener noreferrer">@0xkillcoin</a>
      </p>
    </div>
  );
}

export function RankingsPage() {
  return (
    <DataGate>
      <BoardPage />
    </DataGate>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DataGate } from '../components/DataGate';
import { ProjectCard } from '../components/ProjectCard';
import { useDataReady } from '../context/DataContext';
import { allTags, audienceOptions, filterProjects, type FilterState } from '../lib/data';
import { cx } from '../lib/utils';

const SORTS: Array<{ id: FilterState['sort']; label: string }> = [
  { id: 'recommended', label: '推荐' },
  { id: 'newest', label: '最新收录' },
  { id: 'updated', label: '最近更新' },
  { id: 'name', label: '名称' },
];

function readState(params: URLSearchParams): FilterState {
  const sort = params.get('sort');
  return {
    q: params.get('q') ?? '',
    categories: params.getAll('category'),
    tags: params.getAll('tag'),
    audience: params.get('audience'),
    license: params.get('license') === 'known' ? 'known' : 'any',
    sort: (SORTS.some((s) => s.id === sort) ? sort : 'recommended') as FilterState['sort'],
    page: Number(params.get('page') ?? 1) || 1,
  };
}

function writeState(state: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  for (const c of state.categories) p.append('category', c);
  for (const t of state.tags) p.append('tag', t);
  if (state.audience) p.set('audience', state.audience);
  if (state.license === 'known') p.set('license', 'known');
  if (state.sort !== 'recommended') p.set('sort', state.sort);
  if (state.page > 1) p.set('page', String(state.page));
  return p;
}

function DiscoverInner() {
  const data = useDataReady();
  const [params, setParams] = useSearchParams();
  const state = readState(params);
  const [text, setText] = useState(state.q);
  const tags = useMemo(() => allTags(data), [data]);
  const audiences = useMemo(() => audienceOptions(data), [data]);

  // keep the input in sync when the URL changes (back button, header search)
  useEffect(() => setText(state.q), [state.q]);

  const update = (patch: Partial<FilterState>) => {
    const next: FilterState = { ...state, page: 1, ...patch };
    setParams(writeState(next), { replace: true });
  };

  const result = filterProjects(data, state);
  const activeCount = state.categories.length + state.tags.length + (state.audience ? 1 : 0) + (state.license === 'known' ? 1 : 0) + (state.q ? 1 : 0);

  return (
    <div className="discover">
      <header className="pagehead">
        <p className="eyebrow">INDEX / 全部项目</p>
        <div className="pagehead__row">
          <h1 className="pagehead__title">发现</h1>
          <p className="pagehead__lede">
            共 {data.projects.length} 个项目，{data.categories.length} 个分类。搜名称、一句话介绍、功能描述或标签都能命中。
          </p>
        </div>
      </header>

      <div className="filters">
        <div className="filters__row filters__row--top">
          <form
            className="filters__search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              update({ q: text.trim() });
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                update({ q: e.target.value.trim() });
              }}
              placeholder="搜索：截图、自托管、键盘、SQL…"
              aria-label="搜索项目"
              type="search"
            />
            {text ? (
              <button
                type="button"
                className="filters__clear"
                aria-label="清空搜索"
                onClick={() => {
                  setText('');
                  update({ q: '' });
                }}
              >
                ✕
              </button>
            ) : null}
          </form>

          <div className="filters__sorts" role="group" aria-label="排序">
            <span className="filters__label mono">排序</span>
            {SORTS.map((s) => (
              <button key={s.id} type="button" className={cx('chip', state.sort === s.id && 'is-on')} onClick={() => update({ sort: s.id })} aria-pressed={state.sort === s.id}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filters__row">
          <span className="filters__label mono">分类</span>
          <div className="filters__chips">
            {data.categories.map((c) => {
              const on = state.categories.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  className={cx('chip', on && 'is-on')}
                  aria-pressed={on}
                  onClick={() => update({ categories: on ? state.categories.filter((x) => x !== c.id) : [...state.categories, c.id] })}
                >
                  {c.name}
                  <span className="chip__n mono">{data.projects.filter((p) => p.category === c.id).length}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="filters__row">
          <span className="filters__label mono">标签</span>
          <div className="filters__chips filters__chips--tags">
            {tags.slice(0, 18).map(({ tag, count }) => {
              const on = state.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={cx('tagchip', on && 'is-on')}
                  aria-pressed={on}
                  onClick={() => update({ tags: on ? state.tags.filter((x) => x !== tag) : [...state.tags, tag] })}
                >
                  #{tag}
                  <span className="mono">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="filters__row filters__row--bottom">
          <span className="filters__label mono">人群</span>
          <div className="filters__chips">
            {audiences.map((a) => (
              <button key={a} type="button" className={cx('chip chip--sm', state.audience === a && 'is-on')} aria-pressed={state.audience === a} onClick={() => update({ audience: state.audience === a ? null : a })}>
                {a}
              </button>
            ))}
            <button
              type="button"
              className={cx('chip chip--sm', state.license === 'known' && 'is-on')}
              aria-pressed={state.license === 'known'}
              onClick={() => update({ license: state.license === 'known' ? 'any' : 'known' })}
              title="只显示许可证已确认的项目"
            >
              许可证已确认
            </button>
            {activeCount > 0 ? (
              <button type="button" className="filters__reset" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                清除 {activeCount} 项筛选
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="results">
        <p className="results__count" role="status">
          找到 <strong className="mono">{result.total}</strong> 个项目
          {state.q ? (
            <>
              ，关键词 <em>「{state.q}」</em>
            </>
          ) : null}
          {result.pages > 1 ? <span className="results__pages mono">第 {Math.min(state.page, result.pages)} / {result.pages} 页</span> : null}
        </p>

        {result.items.length === 0 ? (
          <div className="empty">
            <p className="empty__title">没有匹配的项目。</p>
            <p>换个关键词，或者去掉几个筛选条件。也可以直接从分类入口翻。</p>
            <div className="empty__actions">
              <button className="btn" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                清空筛选
              </button>
              <Link className="btn btn--ghost" to="/categories">
                看分类
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid--3">
            {result.items.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        )}

        {result.pages > 1 ? (
          <nav className="pager" aria-label="分页">
            <button className="btn btn--sm" disabled={state.page <= 1} onClick={() => setParams(writeState({ ...state, page: state.page - 1 }))}>
              ← 上一页
            </button>
            <div className="pager__nums">
              {Array.from({ length: result.pages }, (_, i) => i + 1).map((n) => (
                <button key={n} className={cx('pager__num mono', n === Math.min(state.page, result.pages) && 'is-on')} onClick={() => setParams(writeState({ ...state, page: n }))} aria-current={n === state.page ? 'page' : undefined}>
                  {n}
                </button>
              ))}
            </div>
            <button className="btn btn--sm" disabled={state.page >= result.pages} onClick={() => setParams(writeState({ ...state, page: state.page + 1 }))}>
              下一页 →
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}

export function DiscoverPage() {
  return (
    <DataGate>
      <DiscoverInner />
    </DataGate>
  );
}

import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useFavorites } from '../context/FavoritesContext';
import { useTheme } from '../context/ThemeContext';
import { currentIssue } from '../lib/issue';
import { MoonIcon, SunIcon, XLogo, ChartIcon, GridIcon, HomeIcon, BookmarkIcon } from './icons';
import { assetUrl } from '../lib/asset';

/** Author link, shown in the masthead on every page. */
const AUTHOR_X = 'https://x.com/0xkillcoin';
const REPO = 'https://github.com/iiiiiiiiiiiiiKK/today-new-toys';

function SearchInline() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  return (
    <form
      className="search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const q = String(data.get('q') || '').trim();
        navigate(q ? `/discover?q=${encodeURIComponent(q)}` : '/discover');
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <input name="q" type="search" placeholder="搜索项目、标签、关键词" defaultValue={params.get('q') ?? ''} aria-label="搜索项目" autoComplete="off" />
      <kbd>/</kbd>
    </form>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? '浅色' : '深色';
  return (
    <button
      type="button"
      className="navlink navlink--icon themebtn"
      onClick={toggle}
      aria-label={`切换到${next}主题`}
      title={`切换到${next}主题（当前 ${theme === 'dark' ? '深色' : '浅色'}）`}
    >
      {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
    </button>
  );
}

/** Phone-only bottom tab bar: the primary destinations within thumb reach. */
function TabBar() {
  const favorites = useFavorites();
  const item = (to: string, label: string, icon: ReactNode) => (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'tabbar__item is-active' : 'tabbar__item')}>
      {icon}
      <span className="tabbar__label">{label}</span>
      {label === '收藏' && favorites.count > 0 ? <span className="tabbar__badge">{favorites.count}</span> : null}
    </NavLink>
  );
  return (
    <nav className="tabbar" aria-label="底部导航">
      {item('/', '首页', <HomeIcon size={19} />)}
      {item('/rankings', '榜单', <ChartIcon size={19} />)}
      {item('/discover', '发现', <GridIcon size={19} />)}
      {item('/favorites', '收藏', <BookmarkIcon size={19} />)}
    </nav>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { state, retry } = useData();
  const favorites = useFavorites();
  const navigate = useNavigate();
  const issue = currentIssue();
  const dateLabel = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' })
    .format(new Date())
    .replace(/\//g, '.');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (event.key === '/' && !typing) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.search input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const random = () => {
    if (state.status !== 'ready') return;
    const pool = state.data.projects;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    navigate(`/project/${pick.slug}?via=random`);
  };

  return (
    <>
      <a className="skip-link" href="#main">
        跳到正文
      </a>
      <header className="masthead">
        <div className="shell masthead__bar">
          <div className="masthead__brand">
            <Link to="/" className="brand" aria-label="今天又有什么新玩具，返回首页">
              <span className="logo-mark" aria-hidden="true">新</span>
              <span className="brand__text">
                <span className="brand__cn">
                  今天又有什么<span className="brand__accent">新玩具</span>
                </span>
                <span className="brand__en">A daily magazine of open-source toys</span>
              </span>
            </Link>
            <p className="masthead__dateline">
              <span>{issue.id}</span>
              <span className="dot">·</span>
              <span>{dateLabel}</span>
            </p>
          </div>

          <div className="masthead__side">
            <SearchInline />
            <nav className="masthead__nav" aria-label="主导航">
              <NavLink to="/rankings" className={({ isActive }) => (isActive ? 'navlink is-active' : 'navlink')}>
                榜单
              </NavLink>
              <NavLink to="/discover" className={({ isActive }) => (isActive ? 'navlink is-active' : 'navlink')}>
                发现
              </NavLink>
              <NavLink to="/categories" className={({ isActive }) => (isActive ? 'navlink is-active' : 'navlink')}>
                分类
              </NavLink>
              <NavLink to="/favorites" className={({ isActive }) => (isActive ? 'navlink is-active' : 'navlink')}>
                收藏
                {favorites.count > 0 ? <span className="navlink__count">{favorites.count}</span> : null}
              </NavLink>
              <NavLink to="/about" className={({ isActive }) => (isActive ? 'navlink is-active' : 'navlink')}>
                关于
              </NavLink>
              <ThemeToggle />
              <a
                className="navlink navlink--icon"
                href={AUTHOR_X}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="作者 𝕏：@0xkillcoin（在新标签页打开）"
                title="作者 @0xkillcoin"
              >
                <XLogo size={14} />
              </a>
            </nav>
          </div>
        </div>
      </header>

      <main id="main" className="shell page">
        {state.status === 'error' ? (
          <div className="state state--error">
            <p className="eyebrow">数据加载失败</p>
            <h1>没有拿到今天的玩具清单。</h1>
            <p className="state__detail">{state.error}</p>
            <p>静态站点从 <code>/data/projects.json</code> 读取清单。请检查网络，或确认部署时包含了 <code>public/data</code> 目录。</p>
            <button className="btn btn--ink" onClick={retry}>
              重试
            </button>
          </div>
        ) : (
          children
        )}
      </main>

      <footer className="footer">
        <div className="shell footer__grid">
          <div>
            <p className="footer__title">今天又有什么新玩具</p>
            <p className="footer__desc">
              一本每天更新的独立数字杂志，专门发现值得使用的开源项目与互联网工具。介绍由人读过 README 后写成；取不到的数据写作「未知」，不猜、不补。
            </p>
          </div>
          <div className="footer__col">
            <p className="footer__head">逛</p>
            <Link to="/rankings">榜单</Link>
            <Link to="/discover">全部项目</Link>
            <Link to="/categories">分类索引</Link>
            <Link to="/favorites">我的收藏</Link>
            <button className="linklike" onClick={random} type="button">
              随机发现
            </button>
          </div>
          <div className="footer__col">
            <p className="footer__head">编辑部</p>
            <Link to="/about">编辑原则</Link>
            <Link to="/about#data">数据来源</Link>
            <Link to="/about#contribute">如何贡献</Link>
            <Link to="/about#faq">常见问题</Link>
          </div>
          <div className="footer__col">
            <p className="footer__head">订阅与源码</p>
            <a href={assetUrl('feed.xml') ?? '/feed.xml'}>RSS 订阅</a>
            <a href={REPO} target="_blank" rel="noopener noreferrer">
              源码仓库 ↗
            </a>
            <a href={AUTHOR_X} target="_blank" rel="noopener noreferrer">
              作者 𝕏 ↗
            </a>
          </div>
        </div>
        <div className="shell footer__bottom">
          <span className="mono">
            {issue.id} · {dateLabel} · 快照 {state.status === 'ready' ? state.data.snapshotDate : '—'} ·{' '}
            {state.status === 'ready' ? `${state.data.counts.projects} 个项目 / ${state.data.counts.categories} 个分类` : '加载中'}
          </span>
          <span className="mono">© {new Date().getFullYear()} 独立出版 · 保留所有权利</span>
        </div>
      </footer>

      <TabBar />
    </>
  );
}

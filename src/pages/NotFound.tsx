import { Link } from 'react-router-dom';

export function NotFoundPage({ kind = '页面' }: { kind?: string }) {
  return (
    <div className="state">
      <p className="eyebrow">404 · 没有这一页</p>
      <h1>这个{kind}不在清单里。</h1>
      <p>可能是链接写错了，也可能是我们把它下线了。回首页重新逛逛吧。</p>
      <div className="empty__actions" style={{ marginTop: '1.5rem' }}>
        <Link className="btn btn--ink" to="/">
          回到首页
        </Link>
        <Link className="btn btn--ghost" to="/discover">
          浏览全部项目
        </Link>
      </div>
    </div>
  );
}

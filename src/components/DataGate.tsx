import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useData } from '../context/DataContext';

/** Renders children only once the catalogue JSON is in memory; otherwise a real skeleton. */
export function DataGate({ children, label = '正在取今天的清单…' }: { children: ReactNode; label?: string }) {
  const { state, retry } = useData();
  if (state.status === 'ready') return <>{children}</>;
  if (state.status === 'error') {
    return (
      <div className="state state--error">
        <p className="eyebrow">数据加载失败</p>
        <h1>今天的清单没取到。</h1>
        <p className="state__detail">{state.error}</p>
        <p>页面从 <code>/data/projects.json</code> 读取清单。请检查网络，或确认部署产物里包含 <code>data/</code> 目录。</p>
        <button className="btn btn--ink" onClick={retry} type="button">
          重新加载
        </button>
      </div>
    );
  }
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="eyebrow">{label}</p>
      <div className="grid grid--3" style={{ marginTop: '1.5rem' }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton" style={{ aspectRatio: '4 / 3' }} />
        ))}
      </div>
    </div>
  );
}

/** Sets document title + meta description without a dependency. */
export function useSeo({ title, description, image }: { title: string; description?: string; image?: string }) {
  useEffect(() => {
    document.title = title;
    const set = (selector: string, attr: string, value: string) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      if (!el) {
        el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
        if (selector.includes('property=')) el.setAttribute('property', selector.split('property="')[1].replace('"', ''));
        if (selector.includes('name=')) el.setAttribute('name', selector.split('name="')[1].replace('"', ''));
        if (selector.startsWith('link')) el.setAttribute('rel', 'canonical');
        document.head.appendChild(el);
      }
      el.setAttribute(attr, value);
    };
    if (description) set('meta[name="description"]', 'content', description);
    set('meta[property="og:title"]', 'content', title);
    if (description) set('meta[property="og:description"]', 'content', description);
    if (image) set('meta[property="og:image"]', 'content', image);
  }, [title, description, image]);
}

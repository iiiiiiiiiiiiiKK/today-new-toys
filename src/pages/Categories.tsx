import { Link } from 'react-router-dom';
import { DataGate } from '../components/DataGate';
import { Cover } from '../components/Cover';
import { useDataReady } from '../context/DataContext';

export function CategoriesPage() {
  return (
    <DataGate>
      <CategoriesInner />
    </DataGate>
  );
}

function CategoriesInner() {
  const data = useDataReady();
  return (
    <div>
      <header className="pagehead">
        <p className="eyebrow">Sections · 分类索引</p>
        <div className="pagehead__row">
          <h1 className="pagehead__title">十个抽屉</h1>
          <p className="pagehead__lede">分类不是标签云，是编辑面对「这东西该放哪」时的第一反应。每栏都有一段自己的说明。</p>
        </div>
      </header>

      <div className="catsections">
        {data.categories.map((c, index) => {
          const items = data.projects.filter((p) => p.category === c.id);
          const hero = items[0];
          return (
            <section key={c.id} className="catsection">
              <div className="catsection__left">
                <p className="catsection__index mono">{String(index + 1).padStart(2, '0')}</p>
                <h2 className="catsection__name">
                  <Link to={`/category/${c.id}`}>{c.name}</Link>
                </h2>
                <p className="catsection__en mono">{c.english}</p>
                <p className="catsection__intro">{c.intro}</p>
                <Link to={`/category/${c.id}`} className="btn btn--sm">
                  进入 {c.name}（{items.length}）
                </Link>
              </div>
              <div className="catsection__right">
                {hero ? (
                  <Link to={`/project/${hero.slug}`} className="catsection__hero">
                    <Cover src={hero.screenshots[0]?.card || null} alt={hero.screenshots[0]?.alt || hero.name} name={hero.name} ratio="16x10" label={hero.name} labelTone="muted" />
                  </Link>
                ) : null}
                <ul className="catsection__list">
                  {items.slice(1, 4).map((p) => (
                    <li key={p.slug}>
                      <Link to={`/project/${p.slug}`}>{p.name}</Link>
                      <span className="catsection__listline">{p.tagline}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

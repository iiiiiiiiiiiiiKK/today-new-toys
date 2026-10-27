import { Link, useParams } from 'react-router-dom';
import { DataGate } from '../components/DataGate';
import { ProjectCard } from '../components/ProjectCard';
import { useDataReady } from '../context/DataContext';
import { NotFoundPage } from './NotFound';

export function CategoryPage() {
  return (
    <DataGate>
      <CategoryInner />
    </DataGate>
  );
}

function CategoryInner() {
  const { id } = useParams();
  const data = useDataReady();
  const category = data.categories.find((c) => c.id === id);
  if (!category) return <NotFoundPage kind="分类" />;
  const items = data.projects.filter((p) => p.category === category.id);
  const others = data.categories.filter((c) => c.id !== category.id);

  return (
    <div>
      <header className="pagehead pagehead--category">
        <p className="eyebrow">
          <Link to="/categories">分类索引</Link> · {category.english}
        </p>
        <div className="pagehead__row">
          <h1 className="pagehead__title">{category.name}</h1>
          <p className="pagehead__lede">{category.intro}</p>
        </div>
        <p className="pagehead__count mono">{String(items.length).padStart(2, '0')} 个项目</p>
      </header>

      {items.length === 0 ? (
        <div className="empty">
          <p className="empty__title">这一栏还空着。</p>
          <p>我们宁可空着，也不凑数。可以去别处看看。</p>
          <Link className="btn" to="/discover">
            浏览全部项目
          </Link>
        </div>
      ) : (
        <div className="grid grid--3">
          {items.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      )}

      <nav className="crossnav" aria-label="其它分类">
        <p className="eyebrow">继续逛 / KEEP READING</p>
        <div className="crossnav__list">
          {others.map((c) => (
            <Link key={c.id} to={`/category/${c.id}`} className="crossnav__item">
              {c.name}
              <span className="mono">{data.projects.filter((p) => p.category === c.id).length}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

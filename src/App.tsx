import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/Home';
import { DiscoverPage } from './pages/Discover';
import { CategoriesPage } from './pages/Categories';
import { CategoryPage } from './pages/CategoryPage';
import { ProjectPage } from './pages/Project';
import { FavoritesPage } from './pages/Favorites';
import { AboutPage } from './pages/About';
import { NotFoundPage } from './pages/NotFound';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/category/:id" element={<CategoryPage />} />
        <Route path="/project/:slug" element={<ProjectPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}

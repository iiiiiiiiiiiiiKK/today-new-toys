import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { DataProvider } from './context/DataContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { ToastProvider } from './context/ToastContext';
import './styles/global.css';
import './styles/pages.css';

/**
 * Vite injects BASE_URL with a trailing slash ("/" or "/toys/"); react-router wants
 * it without one, and `undefined` for a root deploy.
 */
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <DataProvider>
        <FavoritesProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </FavoritesProvider>
      </DataProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

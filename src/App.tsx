// App shell, routing, and bottom navigation.

import { useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/database';
import { getSettings } from './services/backupService';
import { applyTheme } from './theme';

import { HomeIcon, CatIcon, LitterIcon, FoodIcon, WalletIcon } from './components/icons';

import { DashboardPage } from './pages/DashboardPage';
import { CatsPage } from './pages/CatsPage';
import { SupplyCategoryPage } from './pages/SupplyCategoryPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { SettingsPage } from './pages/SettingsPage';
import { MorePage } from './pages/MorePage';
import { WelcomePage } from './pages/WelcomePage';

function ThemeManager() {
  const settings = useLiveQuery(() => getSettings(), []);
  useEffect(() => {
    applyTheme(settings?.theme ?? 'system');
  }, [settings?.theme]);
  // Listen for system theme changes when using "system" mode.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if ((settings?.theme ?? 'system') === 'system') {
        applyTheme('system');
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings?.theme]);
  return null;
}

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <NavLink
        to="/"
        end
        className="bottom-nav__item"
        aria-label="Dashboard"
      >
        <HomeIcon />
        <span>Dashboard</span>
      </NavLink>
      <NavLink to="/cats" className="bottom-nav__item" aria-label="Cats">
        <CatIcon />
        <span>Cats</span>
      </NavLink>
      <NavLink to="/litter" className="bottom-nav__item" aria-label="Litter">
        <LitterIcon />
        <span>Litter</span>
      </NavLink>
      <NavLink to="/food" className="bottom-nav__item" aria-label="Food">
        <FoodIcon />
        <span>Food</span>
      </NavLink>
      <NavLink to="/more" className="bottom-nav__item" aria-label="More">
        <WalletIcon />
        <span>More</span>
      </NavLink>
    </nav>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/cats" element={<CatsPage />} />
      <Route path="/litter" element={<SupplyCategoryPage category="litter" />} />
      <Route path="/food" element={<SupplyCategoryPage category="food" />} />
      <Route path="/expenses" element={<ExpensesPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/more" element={<MorePage />} />
      <Route path="/welcome" element={<WelcomePage />} />
    </Routes>
  );
}

function FirstRunGate({ children }: { children: React.ReactNode }) {
  const hasCats = useLiveQuery(async () => (await db.cats.count()) > 0, []);
  const settings = useLiveQuery(() => getSettings(), []);
  const navigate = useNavigate();
  const location = useLocation();

  if (hasCats === undefined || settings === undefined) return null; // loading

  // First run: no cats and no demo data → route through the welcome page.
  // /cats is allowed so the welcome page can jump straight into adding a cat.
  const onFirstRunRoute = location.pathname === '/welcome' || location.pathname === '/cats';
  if (!hasCats && !settings?.isDemoDataLoaded && !onFirstRunRoute) {
    navigate('/welcome', { replace: true });
    return null;
  }
  // If data now exists (e.g. demo data was just loaded from the welcome page),
  // leave the first-run route. This guards against a stale `hasCats` from a
  // live query that had not yet re-emitted when the welcome page navigated.
  if (location.pathname === '/welcome' && (hasCats || settings?.isDemoDataLoaded)) {
    navigate('/', { replace: true });
    return null;
  }
  return children;
}

export default function App() {
  return (
    <HashRouter>
      <ThemeManager />
      <FirstRunGate>
        <div className="app-shell">
          <main className="app-main">
            <AppRoutes />
          </main>
          <BottomNav />
        </div>
      </FirstRunGate>
    </HashRouter>
  );
}
import { NavLink, Outlet } from "react-router-dom";

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? "app-header__link app-header__link--active"
    : "app-header__link";
}

export default function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner container">
          <span className="app-header__brand">Raumbuchung</span>
          <nav className="app-header__nav" aria-label="Hauptnavigation">
            <NavLink to="/" end className={navLinkClass}>
              Räume
            </NavLink>
            <NavLink to="/availability" className={navLinkClass}>
              Freie Räume
            </NavLink>
          </nav>
          <span className="app-header__hint">Alle Zeiten in UTC</span>
        </div>
      </header>
      <main className="app-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

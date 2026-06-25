import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NyEjendom from "./pages/NyEjendom";
import EjendomDetalje from "./pages/EjendomDetalje";

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-line bg-paper sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl tracking-tight">Ejendomshealth</span>
            <span className="font-mono text-xs text-slate">v2</span>
          </div>
          <nav className="flex gap-6 font-body text-sm">
            <NavLink
              to="/"
              className={({ isActive }) =>
                isActive ? "text-ink font-medium" : "text-slate hover:text-ink"
              }
            >
              Ejendomme
            </NavLink>
            <NavLink
              to="/ny"
              className={({ isActive }) =>
                isActive ? "text-ink font-medium" : "text-slate hover:text-ink"
              }
            >
              Ny rapport
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ny" element={<NyEjendom />} />
          <Route path="/ejendom/:id" element={<EjendomDetalje />} />
        </Routes>
      </main>

      <footer className="border-t border-line py-4">
        <div className="max-w-5xl mx-auto px-6 text-xs text-slate font-mono">
          Safir Consulting · intern platform
        </div>
      </footer>
    </div>
  );
}

export default App;

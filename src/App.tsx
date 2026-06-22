import { useState } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LoginPage from './pages/LoginPage'
import KunderListePage from './pages/KunderListePage'
import KunderDetaljePage from './pages/KunderDetaljePage'
import EjendomsDetaljePage from './pages/EjendomsDetaljePage'
import type { Ejendom, Kunde } from './types'
import './App.css'

type View =
  | { side: 'kunder' }
  | { side: 'kunde'; kunde: Kunde }
  | { side: 'ejendom'; ejendom: Ejendom; fraKunde: Kunde | null }

function AppIndhold() {
  const { session, loading, signOut } = useAuth()
  const [view, setView] = useState<View>({ side: 'kunder' })

  if (loading) return <div className="centreret">Indlæser…</div>
  if (!session) return <LoginPage />

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          className="app-logo-knap"
          onClick={() => setView({ side: 'kunder' })}
        >
          Ejendomshealth
        </button>
        <nav className="app-nav">
          {view.side === 'ejendom' && view.fraKunde && (
            <button
              className="nav-broed"
              onClick={() => setView({ side: 'kunde', kunde: view.fraKunde! })}
            >
              {view.fraKunde.navn}
            </button>
          )}
        </nav>
        <button className="logud-knap" onClick={signOut}>Log ud</button>
      </header>

      <main>
        {view.side === 'kunder' && (
          <KunderListePage
            onSelectKunde={(k) => setView({ side: 'kunde', kunde: k })}
          />
        )}
        {view.side === 'kunde' && (
          <KunderDetaljePage
            kunde={view.kunde}
            onTilbage={() => setView({ side: 'kunder' })}
            onSelectEjendom={(ej) => setView({ side: 'ejendom', ejendom: ej, fraKunde: view.kunde })}
          />
        )}
        {view.side === 'ejendom' && (
          <EjendomsDetaljePage
            ejendom={view.ejendom}
            onTilbage={() =>
              view.fraKunde
                ? setView({ side: 'kunde', kunde: view.fraKunde })
                : setView({ side: 'kunder' })
            }
          />
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppIndhold />
    </AuthProvider>
  )
}

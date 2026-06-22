import { useState } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LoginPage from './pages/LoginPage'
import EjendomsListePage from './pages/EjendomsListePage'
import EjendomsDetaljePage from './pages/EjendomsDetaljePage'
import type { Ejendom } from './types'
import './App.css'

function AppIndhold() {
  const { session, loading, signOut } = useAuth()
  const [valgtEjendom, setValgtEjendom] = useState<Ejendom | null>(null)

  if (loading) return <div className="centreret">Indlæser…</div>
  if (!session) return <LoginPage />

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Ejendomshealth</h1>
        <button className="logud-knap" onClick={signOut}>
          Log ud
        </button>
      </header>

      <main>
        {valgtEjendom ? (
          <EjendomsDetaljePage
            ejendom={valgtEjendom}
            onTilbage={() => setValgtEjendom(null)}
          />
        ) : (
          <EjendomsListePage onSelect={setValgtEjendom} />
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

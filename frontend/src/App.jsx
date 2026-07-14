import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import Login from './components/Login'
import Items from './components/Items'
import Clients from './components/Clients'
import Loans from './components/Loans'
import './App.css'

const TABS = {
  loans: { label: 'Locations', component: Loans },
  clients: { label: 'Clients', component: Clients },
  items: { label: 'Matériel', component: Items },
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('loans')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) return null
  if (!session) return <Login />

  const ActiveTab = TABS[tab].component

  return (
    <div className="app">
      <header className="app-header">
        <nav>
          {Object.entries(TABS).map(([key, { label }]) => (
            <button
              key={key}
              className={key === tab ? 'active' : ''}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button onClick={() => supabase.auth.signOut()}>Déconnexion</button>
      </header>
      <main>
        <ActiveTab />
      </main>
    </div>
  )
}

export default App

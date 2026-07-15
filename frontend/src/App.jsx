import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Items from './components/Items'
import Clients from './components/Clients'
import Suppliers from './components/Suppliers'
import Purchases from './components/Purchases'
import Orders from './components/Orders'
import Invoices from './components/Invoices'
import Reports from './components/Reports'
import Settings from './components/Settings'
import './App.css'

const TABS = {
  dashboard: { label: 'Tableau de bord', component: Dashboard },
  orders: { label: 'Commandes', component: Orders },
  invoices: { label: 'Factures', component: Invoices },
  reports: { label: 'Rapports', component: Reports },
  clients: { label: 'Clients', component: Clients },
  items: { label: 'Matériel', component: Items },
  purchases: { label: 'Achats', component: Purchases },
  suppliers: { label: 'Fournisseurs', component: Suppliers },
  settings: { label: 'Paramètres', component: Settings },
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')

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

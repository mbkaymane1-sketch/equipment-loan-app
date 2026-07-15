import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const today = () => new Date().toISOString().slice(0, 10)

export default function Dashboard() {
  const [items, setItems] = useState([])
  const [activeOrders, setActiveOrders] = useState([])
  const [error, setError] = useState(null)

  async function load() {
    const [itemsRes, ordersRes] = await Promise.all([
      supabase
        .from('items')
        .select('id, description, stock_actuel, seuil_alerte, qte_totale, cout_moyen')
        .order('description'),
      supabase
        .from('commandes')
        .select('id, date_fin_prevue, clients(clientname)')
        .eq('statut', 'en_cours'),
    ])
    if (itemsRes.error) setError(itemsRes.error.message)
    else setItems(itemsRes.data)
    if (ordersRes.error) setError(ordersRes.error.message)
    else setActiveOrders(ordersRes.data)
  }

  useEffect(() => {
    load()
  }, [])

  const lowStock = items.filter((i) => i.seuil_alerte != null && i.stock_actuel <= i.seuil_alerte)
  const overdue = activeOrders.filter((o) => o.date_fin_prevue && o.date_fin_prevue < today())
  const valeurDisponible = items.reduce((sum, i) => sum + i.stock_actuel * i.cout_moyen, 0)
  const valeurTotaleParc = items.reduce((sum, i) => sum + i.qte_totale * i.cout_moyen, 0)

  return (
    <div className="dashboard">
      {error && <p className="error">{error}</p>}

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-value">{items.reduce((sum, i) => sum + i.stock_actuel, 0)}</span>
          <span className="stat-label">Unités disponibles (total)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{valeurDisponible.toFixed(2)}</span>
          <span className="stat-label">Valeur du stock disponible (coût moyen)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{valeurTotaleParc.toFixed(2)}</span>
          <span className="stat-label">Valeur totale du parc (dont prêté)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{activeOrders.length}</span>
          <span className="stat-label">Commandes en cours</span>
        </div>
        <div className="stat-card stat-card-warning">
          <span className="stat-value">{overdue.length}</span>
          <span className="stat-label">Commandes en retard</span>
        </div>
        <div className="stat-card stat-card-warning">
          <span className="stat-value">{lowStock.length}</span>
          <span className="stat-label">Articles en stock bas</span>
        </div>
      </div>

      <div className="panel">
        <h2>Stock par article</h2>
        <table>
          <thead>
            <tr>
              <th>Article</th>
              <th>Stock disponible</th>
              <th>Qté totale possédée</th>
              <th>Coût moyen</th>
              <th>Valeur (disponible)</th>
              <th>Seuil d'alerte</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const low = item.seuil_alerte != null && item.stock_actuel <= item.seuil_alerte
              return (
                <tr key={item.id} className={low ? 'row-warning' : ''}>
                  <td>{item.description}</td>
                  <td>{item.stock_actuel}{low && ' ⚠️'}</td>
                  <td>{item.qte_totale}</td>
                  <td>{item.cout_moyen.toFixed(2)}</td>
                  <td>{(item.stock_actuel * item.cout_moyen).toFixed(2)}</td>
                  <td>{item.seuil_alerte ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {overdue.length > 0 && (
        <div className="panel">
          <h2>Commandes en retard</h2>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Fin prévue</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((o) => (
                <tr key={o.id} className="row-warning">
                  <td>{o.clients?.clientname}</td>
                  <td>{o.date_fin_prevue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

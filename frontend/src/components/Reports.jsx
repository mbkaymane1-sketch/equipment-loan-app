import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

function groupSum(entries, keyFn) {
  const map = new Map()
  for (const entry of entries) {
    const key = keyFn(entry)
    map.set(key, (map.get(key) ?? 0) + entry.amount)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

export default function Reports() {
  const [invoices, setInvoices] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase
      .from('factures')
      .select('id, date_facture, clients(clientname), facture_lignes(description, qte, prix_unitaire)')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setInvoices(data)
      })
  }, [])

  // Flatten each invoice's lines into { month, client, item, amount } for HT revenue.
  const lineEntries = invoices.flatMap((inv) =>
    (inv.facture_lignes ?? []).map((l) => ({
      month: inv.date_facture?.slice(0, 7),
      client: inv.clients?.clientname ?? '—',
      item: l.description,
      amount: l.qte * l.prix_unitaire,
    }))
  )

  const byMonth = groupSum(lineEntries, (e) => e.month)
  const byClient = groupSum(lineEntries, (e) => e.client)
  const byItem = groupSum(lineEntries, (e) => e.item)
  const totalHt = lineEntries.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="dashboard">
      {error && <p className="error">{error}</p>}

      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-value">{totalHt.toFixed(2)}</span>
          <span className="stat-label">Chiffre d'affaires total (HT, toutes factures)</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{invoices.length}</span>
          <span className="stat-label">Factures émises</span>
        </div>
      </div>

      <div className="panel">
        <h2>Chiffre d'affaires par mois</h2>
        <table>
          <thead><tr><th>Mois</th><th>Total HT</th></tr></thead>
          <tbody>
            {byMonth.map(([month, amount]) => (
              <tr key={month}><td>{month}</td><td>{amount.toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Chiffre d'affaires par client</h2>
        <table>
          <thead><tr><th>Client</th><th>Total HT</th></tr></thead>
          <tbody>
            {byClient.map(([client, amount]) => (
              <tr key={client}><td>{client}</td><td>{amount.toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h2>Chiffre d'affaires par article</h2>
        <table>
          <thead><tr><th>Article</th><th>Total HT</th></tr></thead>
          <tbody>
            {byItem.map(([item, amount]) => (
              <tr key={item}><td>{item}</td><td>{amount.toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

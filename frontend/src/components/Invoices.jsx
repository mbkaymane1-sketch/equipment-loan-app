import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { downloadCsv } from '../lib/csv'
import InvoiceView from './InvoiceView'

function computeTotals(invoice) {
  const ht = (invoice.facture_lignes ?? []).reduce((sum, l) => sum + l.qte * l.prix_unitaire, 0)
  const tva = ht * (invoice.taux_tva / 100)
  return { ht, tva, ttc: ht + tva }
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [error, setError] = useState(null)
  const [viewing, setViewing] = useState(null)

  async function load() {
    const { data, error } = await supabase
      .from('factures')
      .select('*, clients(clientname, adresse, contact), facture_lignes(*)')
      .order('id', { ascending: false })
    if (error) setError(error.message)
    else setInvoices(data)
  }

  useEffect(() => {
    load()
  }, [])

  async function updatePayment(id, fields) {
    const { error } = await supabase.from('factures').update(fields).eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('factures').delete().eq('id', id)
    if (error) setError(error.message)
    else load()
  }

  function handleExport() {
    const rows = invoices.map((inv) => ({ inv, totals: computeTotals(inv) }))
    downloadCsv('factures.csv', [
      { label: 'Numéro', value: (r) => r.inv.numero },
      { label: 'Client', value: (r) => r.inv.clients?.clientname },
      { label: 'Date', value: (r) => r.inv.date_facture },
      { label: 'Total HT', value: (r) => r.totals.ht.toFixed(2) },
      { label: 'TVA', value: (r) => r.totals.tva.toFixed(2) },
      { label: 'Total TTC', value: (r) => r.totals.ttc.toFixed(2) },
      { label: 'Statut paiement', value: (r) => r.inv.statut_paiement },
    ], rows)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Factures</h2>
        <button onClick={handleExport}>Exporter CSV</button>
      </div>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Numéro</th>
            <th>Client</th>
            <th>Date</th>
            <th>Total TTC</th>
            <th>Statut</th>
            <th>Paiement</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const totals = computeTotals(inv)
            return (
              <tr key={inv.id}>
                <td>{inv.numero}</td>
                <td>{inv.clients?.clientname}</td>
                <td>{inv.date_facture}</td>
                <td>{totals.ttc.toFixed(2)}</td>
                <td>
                  <select
                    value={inv.statut_paiement}
                    onChange={(e) => updatePayment(inv.id, { statut_paiement: e.target.value })}
                  >
                    <option value="impayee">Impayée</option>
                    <option value="partielle">Partielle</option>
                    <option value="payee">Payée</option>
                  </select>
                </td>
                <td>
                  <input
                    placeholder="Mode de paiement"
                    defaultValue={inv.mode_paiement ?? ''}
                    onBlur={(e) => updatePayment(inv.id, { mode_paiement: e.target.value || null })}
                  />
                </td>
                <td>
                  <button onClick={() => setViewing(inv)}>Voir / Imprimer</button>
                  <button onClick={() => handleDelete(inv.id)}>Supprimer</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {viewing && <InvoiceView invoice={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}

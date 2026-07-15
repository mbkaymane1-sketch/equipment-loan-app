import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { downloadCsv } from '../lib/csv'

export default function Clients() {
  const [clients, setClients] = useState([])
  const [clientname, setClientname] = useState('')
  const [adresse, setAdresse] = useState('')
  const [contact, setContact] = useState('')
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [history, setHistory] = useState(null)

  async function loadClients() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('id', { ascending: false })
    if (error) setError(error.message)
    else setClients(data)
  }

  useEffect(() => {
    loadClients()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase
      .from('clients')
      .insert({ clientname, adresse, contact })
    if (error) {
      setError(error.message)
      return
    }
    setClientname('')
    setAdresse('')
    setContact('')
    loadClients()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) setError(error.message)
    else loadClients()
  }

  function handleExport() {
    downloadCsv('clients.csv', [
      { label: 'ID', value: 'id' },
      { label: 'Nom', value: 'clientname' },
      { label: 'Adresse', value: 'adresse' },
      { label: 'Contact', value: 'contact' },
    ], clients)
  }

  async function toggleHistory(client) {
    if (expanded === client.id) {
      setExpanded(null)
      setHistory(null)
      return
    }
    setExpanded(client.id)
    const [ordersRes, invoicesRes] = await Promise.all([
      supabase
        .from('commandes')
        .select('id, date_debut, date_fin_prevue, statut, commande_lignes(qte, prix, items(description))')
        .eq('idclients', client.id)
        .order('id', { ascending: false }),
      supabase
        .from('factures')
        .select('id, numero, date_facture, statut_paiement, facture_lignes(qte, prix_unitaire)')
        .eq('idclients', client.id)
        .order('id', { ascending: false }),
    ])
    setHistory({
      orders: ordersRes.data ?? [],
      invoices: invoicesRes.data ?? [],
    })
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Clients</h2>
        <button onClick={handleExport}>Exporter CSV</button>
      </div>
      <form className="inline-form" onSubmit={handleAdd}>
        <input
          placeholder="Nom du client"
          value={clientname}
          onChange={(e) => setClientname(e.target.value)}
          required
        />
        <input
          placeholder="Adresse"
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
        />
        <input
          placeholder="Contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <button type="submit">Ajouter</button>
      </form>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th></th>
            <th>ID</th>
            <th>Nom</th>
            <th>Adresse</th>
            <th>Contact</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => {
            const isOpen = expanded === client.id
            return (
              <Fragment key={client.id}>
                <tr>
                  <td>
                    <button onClick={() => toggleHistory(client)}>{isOpen ? '▾' : '▸'}</button>
                  </td>
                  <td>{client.id}</td>
                  <td>{client.clientname}</td>
                  <td>{client.adresse}</td>
                  <td>{client.contact}</td>
                  <td>
                    <button onClick={() => handleDelete(client.id)}>Supprimer</button>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={6}>
                      {!history ? (
                        <p className="hint">Chargement…</p>
                      ) : (
                        <div className="client-history">
                          <div>
                            <h4>Commandes</h4>
                            {history.orders.length === 0 && <p className="hint">Aucune commande.</p>}
                            <table className="sub-table">
                              <thead>
                                <tr><th>Début</th><th>Fin prévue</th><th>Statut</th><th>Articles</th></tr>
                              </thead>
                              <tbody>
                                {history.orders.map((o) => (
                                  <tr key={o.id}>
                                    <td>{o.date_debut}</td>
                                    <td>{o.date_fin_prevue ?? '—'}</td>
                                    <td><span className={`badge badge-${o.statut}`}>{o.statut}</span></td>
                                    <td>
                                      {(o.commande_lignes ?? [])
                                        .map((l) => `${l.items?.description} ×${l.qte}`)
                                        .join(', ')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div>
                            <h4>Factures</h4>
                            {history.invoices.length === 0 && <p className="hint">Aucune facture.</p>}
                            <table className="sub-table">
                              <thead>
                                <tr><th>Numéro</th><th>Date</th><th>Statut paiement</th><th>Total</th></tr>
                              </thead>
                              <tbody>
                                {history.invoices.map((inv) => {
                                  const total = (inv.facture_lignes ?? []).reduce(
                                    (sum, l) => sum + l.qte * l.prix_unitaire, 0
                                  )
                                  return (
                                    <tr key={inv.id}>
                                      <td>{inv.numero}</td>
                                      <td>{inv.date_facture}</td>
                                      <td>{inv.statut_paiement}</td>
                                      <td>{total.toFixed(2)}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

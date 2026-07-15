import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { downloadCsv } from '../lib/csv'

const today = () => new Date().toISOString().slice(0, 10)
const emptyLine = () => ({ iditem: '', qte: 1, prix: '' })

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [clients, setClients] = useState([])
  const [items, setItems] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [idclients, setIdclients] = useState('')
  const [dateDebut, setDateDebut] = useState(today())
  const [dateFinPrevue, setDateFinPrevue] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState([emptyLine()])

  async function loadOrders() {
    const { data, error } = await supabase
      .from('commandes')
      .select('*, clients(clientname), commande_lignes(id, iditem, qte, prix, date_retour_reelle, items(description))')
      .order('id', { ascending: false })
    if (error) setError(error.message)
    else setOrders(data)
  }

  async function loadOptions() {
    const [clientsRes, itemsRes] = await Promise.all([
      supabase.from('clients').select('id, clientname').order('clientname'),
      supabase.from('items').select('id, description, stock_actuel').order('description'),
    ])
    if (clientsRes.data) setClients(clientsRes.data)
    if (itemsRes.data) setItems(itemsRes.data)
  }

  useEffect(() => {
    loadOrders()
    loadOptions()
  }, [])

  function updateLine(index, field, value) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(index) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleCreateOrder(e) {
    e.preventDefault()
    setError(null)

    const validLines = lines.filter((l) => l.iditem)
    if (validLines.length === 0) {
      setError('Ajoutez au moins un article à la commande.')
      return
    }

    const { data: order, error: orderError } = await supabase
      .from('commandes')
      .insert({
        idclients,
        date_debut: dateDebut,
        date_fin_prevue: dateFinPrevue || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (orderError) {
      setError(orderError.message)
      return
    }

    const { error: linesError } = await supabase.from('commande_lignes').insert(
      validLines.map((l) => ({
        id_commande: order.id,
        iditem: l.iditem,
        qte: l.qte,
        prix: l.prix || null,
      }))
    )

    if (linesError) {
      setError(linesError.message)
      await supabase.from('commandes').delete().eq('id', order.id)
      return
    }

    setIdclients('')
    setDateDebut(today())
    setDateFinPrevue('')
    setNotes('')
    setLines([emptyLine()])
    loadOrders()
    loadOptions()
  }

  async function handleReturnLine(lineId) {
    const { error } = await supabase
      .from('commande_lignes')
      .update({ date_retour_reelle: today() })
      .eq('id', lineId)
    if (error) setError(error.message)
    else {
      loadOrders()
      loadOptions()
    }
  }

  async function handleDeleteOrder(id) {
    const { error } = await supabase.from('commandes').delete().eq('id', id)
    if (error) setError(error.message)
    else {
      loadOrders()
      loadOptions()
    }
  }

  async function handleGenerateInvoice(order) {
    setError(null)
    setNotice(null)
    const lines = order.commande_lignes ?? []
    if (lines.length === 0) {
      setError('Cette commande n\'a aucun article, impossible de générer une facture.')
      return
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('factures')
      .insert({ id_commande: order.id, idclients: order.idclients })
      .select()
      .single()

    if (invoiceError) {
      setError(invoiceError.message)
      return
    }

    const { error: linesError } = await supabase.from('facture_lignes').insert(
      lines.map((l) => ({
        id_facture: invoice.id,
        description: l.items?.description ?? 'Article',
        qte: l.qte,
        prix_unitaire: l.prix ?? 0,
      }))
    )

    if (linesError) {
      setError(linesError.message)
      await supabase.from('factures').delete().eq('id', invoice.id)
      return
    }

    const lateLines = lines.filter((l) => isLineLate(l, order))
    setNotice(
      `Facture ${invoice.numero} créée (onglet Factures).` +
        (lateLines.length > 0
          ? ` ⚠️ ${lateLines.length} article(s) en retard sur cette commande — pensez à ajouter une pénalité manuellement si besoin.`
          : '')
    )
  }

  function isLineLate(line, order) {
    if (!order.date_fin_prevue) return false
    const reference = line.date_retour_reelle ?? today()
    return reference > order.date_fin_prevue
  }

  function handleExport() {
    const rows = orders.flatMap((o) =>
      (o.commande_lignes ?? []).map((l) => ({ order: o, line: l }))
    )
    downloadCsv('commandes.csv', [
      { label: 'Commande', value: (r) => r.order.id },
      { label: 'Client', value: (r) => r.order.clients?.clientname },
      { label: 'Statut', value: (r) => r.order.statut },
      { label: 'Début', value: (r) => r.order.date_debut },
      { label: 'Fin prévue', value: (r) => r.order.date_fin_prevue },
      { label: 'Article', value: (r) => r.line.items?.description },
      { label: 'Qté', value: (r) => r.line.qte },
      { label: 'Prix', value: (r) => r.line.prix },
      { label: 'Retourné le', value: (r) => r.line.date_retour_reelle },
    ], rows)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Commandes clients</h2>
        <button onClick={handleExport}>Exporter CSV</button>
      </div>

      <form className="order-form" onSubmit={handleCreateOrder}>
        <div className="inline-form">
          <select value={idclients} onChange={(e) => setIdclients(e.target.value)} required>
            <option value="" disabled>Client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.clientname}</option>
            ))}
          </select>
          <label>
            Début
            <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} required />
          </label>
          <label>
            Fin prévue
            <input type="date" value={dateFinPrevue} onChange={(e) => setDateFinPrevue(e.target.value)} />
          </label>
          <input
            placeholder="Notes (optionnel)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <table className="lines-editor">
          <thead>
            <tr>
              <th>Article</th>
              <th>Qté</th>
              <th>Prix</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index}>
                <td>
                  <select
                    value={line.iditem}
                    onChange={(e) => updateLine(index, 'iditem', e.target.value)}
                  >
                    <option value="" disabled>Article</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.description} (stock: {i.stock_actuel})
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={line.qte}
                    onChange={(e) => updateLine(index, 'qte', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Prix"
                    value={line.prix}
                    onChange={(e) => updateLine(index, 'prix', e.target.value)}
                  />
                </td>
                <td>
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(index)}>Retirer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={addLine}>+ Ajouter un article</button>
        <button type="submit" className="primary">Créer la commande</button>
      </form>

      {error && <p className="error">{error}</p>}
      {notice && <p className="hint">{notice}</p>}

      <table>
        <thead>
          <tr>
            <th></th>
            <th>ID</th>
            <th>Client</th>
            <th>Statut</th>
            <th>Début</th>
            <th>Fin prévue</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const overdue = order.statut === 'en_cours' && order.date_fin_prevue && order.date_fin_prevue < today()
            const isOpen = expanded === order.id
            return (
              <Fragment key={order.id}>
                <tr className={overdue ? 'row-warning' : ''}>
                  <td>
                    <button onClick={() => setExpanded(isOpen ? null : order.id)}>
                      {isOpen ? '▾' : '▸'}
                    </button>
                  </td>
                  <td>{order.id}</td>
                  <td>{order.clients?.clientname}</td>
                  <td>
                    <span className={`badge badge-${order.statut}`}>{order.statut}</span>
                    {overdue && ' ⚠️ en retard'}
                  </td>
                  <td>{order.date_debut}</td>
                  <td>{order.date_fin_prevue ?? '—'}</td>
                  <td>
                    <button onClick={() => handleGenerateInvoice(order)}>Générer facture</button>
                    <button onClick={() => handleDeleteOrder(order.id)}>Supprimer</button>
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={7}>
                      <table className="sub-table">
                        <thead>
                          <tr>
                            <th>Article</th>
                            <th>Qté</th>
                            <th>Prix</th>
                            <th>Retourné le</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(order.commande_lignes ?? []).map((line) => {
                            const late = isLineLate(line, order)
                            return (
                              <tr key={line.id} className={late ? 'row-warning' : ''}>
                                <td>{line.items?.description}</td>
                                <td>{line.qte}</td>
                                <td>{line.prix ?? '—'}</td>
                                <td>
                                  {line.date_retour_reelle ?? '—'}
                                  {late && (line.date_retour_reelle ? ' ⚠️ retourné en retard' : ' ⚠️ en retard')}
                                </td>
                                <td>
                                  {!line.date_retour_reelle && (
                                    <button onClick={() => handleReturnLine(line.id)}>
                                      Marquer retourné
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
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

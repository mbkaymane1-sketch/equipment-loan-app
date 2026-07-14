import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { downloadCsv } from '../lib/csv'

export default function Purchases() {
  const [purchases, setPurchases] = useState([])
  const [items, setItems] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [idSupplier, setIdSupplier] = useState('')
  const [iditem, setIditem] = useState('')
  const [qte, setQte] = useState(1)
  const [prixAchat, setPrixAchat] = useState('')
  const [dateAchat, setDateAchat] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState(null)

  async function loadPurchases() {
    const { data, error } = await supabase
      .from('achats')
      .select('*, items(description), suppliers(name)')
      .order('id', { ascending: false })
    if (error) setError(error.message)
    else setPurchases(data)
  }

  async function loadOptions() {
    const [itemsRes, suppliersRes] = await Promise.all([
      supabase.from('items').select('id, description').order('description'),
      supabase.from('suppliers').select('id, name').order('name'),
    ])
    if (itemsRes.data) setItems(itemsRes.data)
    if (suppliersRes.data) setSuppliers(suppliersRes.data)
  }

  useEffect(() => {
    loadPurchases()
    loadOptions()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.from('achats').insert({
      id_supplier: idSupplier || null,
      iditem,
      qte,
      prix_achat: prixAchat || null,
      date_achat: dateAchat,
    })
    if (error) {
      setError(error.message)
      return
    }
    setIditem('')
    setIdSupplier('')
    setQte(1)
    setPrixAchat('')
    loadPurchases()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('achats').delete().eq('id', id)
    if (error) setError(error.message)
    else loadPurchases()
  }

  function handleExport() {
    downloadCsv('achats.csv', [
      { label: 'ID', value: 'id' },
      { label: 'Fournisseur', value: (r) => r.suppliers?.name },
      { label: 'Article', value: (r) => r.items?.description },
      { label: 'Qté', value: 'qte' },
      { label: 'Prix achat', value: 'prix_achat' },
      { label: 'Date', value: 'date_achat' },
    ], purchases)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Achats (entrées de stock)</h2>
        <button onClick={handleExport}>Exporter CSV</button>
      </div>
      <form className="inline-form" onSubmit={handleAdd}>
        <select value={iditem} onChange={(e) => setIditem(e.target.value)} required>
          <option value="" disabled>Article</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>{i.description}</option>
          ))}
        </select>
        <select value={idSupplier} onChange={(e) => setIdSupplier(e.target.value)}>
          <option value="">Fournisseur (optionnel)</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          placeholder="Qté"
          value={qte}
          onChange={(e) => setQte(e.target.value)}
          required
        />
        <input
          type="number"
          step="0.01"
          placeholder="Prix d'achat"
          value={prixAchat}
          onChange={(e) => setPrixAchat(e.target.value)}
        />
        <label>
          Date
          <input
            type="date"
            value={dateAchat}
            onChange={(e) => setDateAchat(e.target.value)}
            required
          />
        </label>
        <button type="submit">Enregistrer l'achat</button>
      </form>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Article</th>
            <th>Fournisseur</th>
            <th>Qté</th>
            <th>Prix achat</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {purchases.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.items?.description}</td>
              <td>{p.suppliers?.name ?? '—'}</td>
              <td>{p.qte}</td>
              <td>{p.prix_achat ?? '—'}</td>
              <td>{p.date_achat}</td>
              <td>
                <button onClick={() => handleDelete(p.id)}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

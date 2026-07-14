import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { downloadCsv } from '../lib/csv'

export default function Items() {
  const [items, setItems] = useState([])
  const [description, setDescription] = useState('')
  const [type, setType] = useState('')
  const [seuilAlerte, setSeuilAlerte] = useState('')
  const [error, setError] = useState(null)

  async function loadItems() {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .order('id', { ascending: false })
    if (error) setError(error.message)
    else setItems(data)
  }

  useEffect(() => {
    loadItems()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase
      .from('items')
      .insert({ description, type, seuil_alerte: seuilAlerte || null })
    if (error) {
      setError(error.message)
      return
    }
    setDescription('')
    setType('')
    setSeuilAlerte('')
    loadItems()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) setError(error.message)
    else loadItems()
  }

  function handleExport() {
    downloadCsv('materiel.csv', [
      { label: 'ID', value: 'id' },
      { label: 'Description', value: 'description' },
      { label: 'Type', value: 'type' },
      { label: 'Stock actuel', value: 'stock_actuel' },
      { label: 'Seuil alerte', value: 'seuil_alerte' },
    ], items)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Matériel</h2>
        <button onClick={handleExport}>Exporter CSV</button>
      </div>
      <form className="inline-form" onSubmit={handleAdd}>
        <input
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <input
          placeholder="Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
        <input
          type="number"
          min="0"
          placeholder="Seuil d'alerte"
          value={seuilAlerte}
          onChange={(e) => setSeuilAlerte(e.target.value)}
        />
        <button type="submit">Ajouter</button>
      </form>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Description</th>
            <th>Type</th>
            <th>Stock</th>
            <th>Seuil alerte</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const low = item.seuil_alerte != null && item.stock_actuel <= item.seuil_alerte
            return (
              <tr key={item.id} className={low ? 'row-warning' : ''}>
                <td>{item.id}</td>
                <td>{item.description}</td>
                <td>{item.type}</td>
                <td>{item.stock_actuel}{low && ' ⚠️'}</td>
                <td>{item.seuil_alerte ?? '—'}</td>
                <td>
                  <button onClick={() => handleDelete(item.id)}>Supprimer</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

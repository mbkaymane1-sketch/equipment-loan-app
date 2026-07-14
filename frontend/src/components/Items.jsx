import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Items() {
  const [items, setItems] = useState([])
  const [description, setDescription] = useState('')
  const [type, setType] = useState('')
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
      .insert({ description, type })
    if (error) {
      setError(error.message)
      return
    }
    setDescription('')
    setType('')
    loadItems()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) setError(error.message)
    else loadItems()
  }

  return (
    <div className="panel">
      <h2>Matériel</h2>
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
        <button type="submit">Ajouter</button>
      </form>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Description</th>
            <th>Type</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.description}</td>
              <td>{item.type}</td>
              <td>
                <button onClick={() => handleDelete(item.id)}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

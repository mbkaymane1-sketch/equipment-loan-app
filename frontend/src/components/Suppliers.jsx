import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { downloadCsv } from '../lib/csv'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [name, setName] = useState('')
  const [adresse, setAdresse] = useState('')
  const [contact, setContact] = useState('')
  const [error, setError] = useState(null)

  async function loadSuppliers() {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('id', { ascending: false })
    if (error) setError(error.message)
    else setSuppliers(data)
  }

  useEffect(() => {
    loadSuppliers()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.from('suppliers').insert({ name, adresse, contact })
    if (error) {
      setError(error.message)
      return
    }
    setName('')
    setAdresse('')
    setContact('')
    loadSuppliers()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) setError(error.message)
    else loadSuppliers()
  }

  function handleExport() {
    downloadCsv('fournisseurs.csv', [
      { label: 'ID', value: 'id' },
      { label: 'Nom', value: 'name' },
      { label: 'Adresse', value: 'adresse' },
      { label: 'Contact', value: 'contact' },
    ], suppliers)
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Fournisseurs</h2>
        <button onClick={handleExport}>Exporter CSV</button>
      </div>
      <form className="inline-form" onSubmit={handleAdd}>
        <input
          placeholder="Nom du fournisseur"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
            <th>ID</th>
            <th>Nom</th>
            <th>Adresse</th>
            <th>Contact</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.name}</td>
              <td>{s.adresse}</td>
              <td>{s.contact}</td>
              <td>
                <button onClick={() => handleDelete(s.id)}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

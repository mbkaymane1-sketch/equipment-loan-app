import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Clients() {
  const [clients, setClients] = useState([])
  const [clientname, setClientname] = useState('')
  const [adresse, setAdresse] = useState('')
  const [contact, setContact] = useState('')
  const [error, setError] = useState(null)

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

  return (
    <div className="panel">
      <h2>Clients</h2>
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
            <th>ID</th>
            <th>Nom</th>
            <th>Adresse</th>
            <th>Contact</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id}>
              <td>{client.id}</td>
              <td>{client.clientname}</td>
              <td>{client.adresse}</td>
              <td>{client.contact}</td>
              <td>
                <button onClick={() => handleDelete(client.id)}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Loans() {
  const [loans, setLoans] = useState([])
  const [clients, setClients] = useState([])
  const [items, setItems] = useState([])
  const [idclients, setIdclients] = useState('')
  const [iditem, setIditem] = useState('')
  const [qte, setQte] = useState(1)
  const [prix, setPrix] = useState('')
  const [debutLocation, setDebutLocation] = useState('')
  const [finLocation, setFinLocation] = useState('')
  const [error, setError] = useState(null)

  async function loadLoans() {
    const { data, error } = await supabase
      .from('commandeclient')
      .select('*, clients(clientname), items(description)')
      .order('id', { ascending: false })
    if (error) setError(error.message)
    else setLoans(data)
  }

  async function loadOptions() {
    const [clientsRes, itemsRes] = await Promise.all([
      supabase.from('clients').select('id, clientname').order('clientname'),
      supabase.from('items').select('id, description').order('description'),
    ])
    if (clientsRes.data) setClients(clientsRes.data)
    if (itemsRes.data) setItems(itemsRes.data)
  }

  useEffect(() => {
    loadLoans()
    loadOptions()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.from('commandeclient').insert({
      idclients: idclients,
      iditem: iditem,
      qte,
      prix: prix || null,
      debut_location: debutLocation,
      fin_location: finLocation || null,
    })
    if (error) {
      setError(error.message)
      return
    }
    setIdclients('')
    setIditem('')
    setQte(1)
    setPrix('')
    setDebutLocation('')
    setFinLocation('')
    loadLoans()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('commandeclient').delete().eq('id', id)
    if (error) setError(error.message)
    else loadLoans()
  }

  return (
    <div className="panel">
      <h2>Locations</h2>
      <form className="inline-form" onSubmit={handleAdd}>
        <select value={idclients} onChange={(e) => setIdclients(e.target.value)} required>
          <option value="" disabled>Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.clientname}</option>
          ))}
        </select>
        <select value={iditem} onChange={(e) => setIditem(e.target.value)} required>
          <option value="" disabled>Matériel</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>{i.description}</option>
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
          placeholder="Prix"
          value={prix}
          onChange={(e) => setPrix(e.target.value)}
        />
        <label>
          Début
          <input
            type="date"
            value={debutLocation}
            onChange={(e) => setDebutLocation(e.target.value)}
            required
          />
        </label>
        <label>
          Fin
          <input
            type="date"
            value={finLocation}
            onChange={(e) => setFinLocation(e.target.value)}
          />
        </label>
        <button type="submit">Ajouter</button>
      </form>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Client</th>
            <th>Matériel</th>
            <th>Qté</th>
            <th>Prix</th>
            <th>Début</th>
            <th>Fin</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr key={loan.id}>
              <td>{loan.id}</td>
              <td>{loan.clients?.clientname}</td>
              <td>{loan.items?.description}</td>
              <td>{loan.qte}</td>
              <td>{loan.prix}</td>
              <td>{loan.debut_location}</td>
              <td>{loan.fin_location ?? '—'}</td>
              <td>
                <button onClick={() => handleDelete(loan.id)}>Supprimer</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Settings() {
  const [form, setForm] = useState(null)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('parametres').select('*').eq('id', 1).single()
    if (error) setError(error.message)
    else setForm(data)
  }

  useEffect(() => {
    load()
  }, [])

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase
      .from('parametres')
      .update({
        nom_entreprise: form.nom_entreprise,
        adresse: form.adresse,
        ice: form.ice,
        telephone: form.telephone,
        email: form.email,
        taux_tva_defaut: form.taux_tva_defaut,
      })
      .eq('id', 1)
    if (error) setError(error.message)
    else setSaved(true)
  }

  if (!form) return <div className="panel">Chargement…</div>

  return (
    <div className="panel">
      <h2>Paramètres de l'entreprise</h2>
      <p className="hint">Ces informations apparaissent sur l'en-tête des factures.</p>
      <form className="settings-form" onSubmit={handleSave}>
        <label>
          Nom de l'entreprise
          <input
            value={form.nom_entreprise ?? ''}
            onChange={(e) => update('nom_entreprise', e.target.value)}
          />
        </label>
        <label>
          Adresse
          <input value={form.adresse ?? ''} onChange={(e) => update('adresse', e.target.value)} />
        </label>
        <label>
          ICE / RC
          <input value={form.ice ?? ''} onChange={(e) => update('ice', e.target.value)} />
        </label>
        <label>
          Téléphone
          <input value={form.telephone ?? ''} onChange={(e) => update('telephone', e.target.value)} />
        </label>
        <label>
          Email
          <input value={form.email ?? ''} onChange={(e) => update('email', e.target.value)} />
        </label>
        <label>
          Taux de TVA par défaut (%)
          <input
            type="number"
            step="0.01"
            value={form.taux_tva_defaut ?? 20}
            onChange={(e) => update('taux_tva_defaut', e.target.value)}
          />
        </label>
        <button type="submit" className="primary">Enregistrer</button>
        {saved && <span className="hint">Enregistré ✓</span>}
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

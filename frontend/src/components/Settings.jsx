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

  function handleLogoFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        // Downscale so the logo doesn't bloat the parametres row / invoice HTML.
        const maxWidth = 320
        const scale = Math.min(1, maxWidth / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * scale
        canvas.height = img.height * scale
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        update('logo_url', canvas.toDataURL('image/png', 0.85))
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
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
        logo_url: form.logo_url,
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
          Logo
          <input type="file" accept="image/*" onChange={handleLogoFile} />
        </label>
        {form.logo_url && (
          <div className="logo-preview">
            <img src={form.logo_url} alt="Logo" />
            <button type="button" onClick={() => update('logo_url', null)}>Retirer le logo</button>
          </div>
        )}
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

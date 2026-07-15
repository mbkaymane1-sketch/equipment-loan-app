import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabaseClient'

export default function InvoiceView({ invoice, onClose }) {
  const [entreprise, setEntreprise] = useState(null)

  useEffect(() => {
    supabase
      .from('parametres')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => setEntreprise(data))
  }, [])

  const lines = invoice.facture_lignes ?? []
  const ht = lines.reduce((sum, l) => sum + l.qte * l.prix_unitaire, 0)
  const tva = ht * (invoice.taux_tva / 100)
  const ttc = ht + tva

  return createPortal(
    <div className="invoice-overlay">
      <div className="invoice-toolbar no-print">
        <button onClick={() => window.print()} className="primary">Imprimer / PDF</button>
        <button onClick={onClose}>Fermer</button>
      </div>
      <div className="invoice-paper">
        <header className="invoice-letterhead">
          <div>
            <h1>{entreprise?.nom_entreprise || 'Votre entreprise'}</h1>
            {entreprise?.adresse && <p>{entreprise.adresse}</p>}
            {entreprise?.ice && <p>ICE: {entreprise.ice}</p>}
            {entreprise?.telephone && <p>Tél: {entreprise.telephone}</p>}
            {entreprise?.email && <p>{entreprise.email}</p>}
          </div>
          <div className="invoice-meta">
            <h2>Facture {invoice.numero}</h2>
            <p>Date: {invoice.date_facture}</p>
          </div>
        </header>

        <section className="invoice-client">
          <h3>Client</h3>
          <p>{invoice.clients?.clientname}</p>
          {invoice.clients?.adresse && <p>{invoice.clients.adresse}</p>}
          {invoice.clients?.contact && <p>{invoice.clients.contact}</p>}
        </section>

        <table className="invoice-lines">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qté</th>
              <th>Prix unitaire</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td>{l.description}</td>
                <td>{l.qte}</td>
                <td>{l.prix_unitaire.toFixed(2)}</td>
                <td>{(l.qte * l.prix_unitaire).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="invoice-totals">
          <div><span>Total HT</span><span>{ht.toFixed(2)}</span></div>
          <div><span>TVA ({invoice.taux_tva}%)</span><span>{tva.toFixed(2)}</span></div>
          <div className="invoice-ttc"><span>Total TTC</span><span>{ttc.toFixed(2)}</span></div>
        </div>

        <p className="invoice-payment-status">
          Statut de paiement: <strong>{invoice.statut_paiement}</strong>
          {invoice.mode_paiement && ` — ${invoice.mode_paiement}`}
          {invoice.date_paiement && ` (${invoice.date_paiement})`}
        </p>

        {invoice.notes && <p className="invoice-notes">{invoice.notes}</p>}
      </div>
    </div>,
    document.body
  )
}

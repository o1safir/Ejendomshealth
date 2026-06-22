import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import DawaAdresseSoeg, { type ValgtAdresse } from '../components/DawaAdresseSoeg'
import type { Ejendom, Kunde } from '../types'

interface Props {
  kunde: Kunde
  onTilbage: () => void
  onSelectEjendom: (ejendom: Ejendom) => void
}

export default function KunderDetaljePage({ kunde, onTilbage, onSelectEjendom }: Props) {
  const [ejendomme, setEjendomme] = useState<Ejendom[]>([])
  const [loading, setLoading] = useState(true)
  const [visForm, setVisForm] = useState(false)
  const [fejl, setFejl] = useState<string | null>(null)

  // Rediger kunde
  const [redigerKunde, setRedigerKunde] = useState(false)
  const [editNavn, setEditNavn] = useState(kunde.navn)
  const [editKontaktperson, setEditKontaktperson] = useState(kunde.kontaktperson ?? '')
  const [editEmail, setEditEmail] = useState(kunde.email ?? '')
  const [editTelefon, setEditTelefon] = useState(kunde.telefon ?? '')

  // Ny ejendom-form
  const [ejNavn, setEjNavn] = useState('')
  const [ejAdresse, setEjAdresse] = useState('')
  const [ejPostnr, setEjPostnr] = useState('')
  const [dawaValgt, setDawaValgt] = useState(false)

  async function hentEjendomme() {
    setLoading(true)
    const { data, error } = await supabase
      .from('ejendomme')
      .select('*')
      .eq('kunde_id', kunde.id)
      .order('updated_at', { ascending: false })
    if (error) setFejl(error.message)
    else setEjendomme(data ?? [])
    setLoading(false)
  }

  useEffect(() => { hentEjendomme() }, [kunde.id])

  function handleDawaValgt(a: ValgtAdresse) {
    setEjAdresse(a.fuld_tekst)
    setEjPostnr(a.postnr)
    if (!ejNavn) setEjNavn(a.fuld_tekst)
    setDawaValgt(true)
  }

  async function handleOpretEjendom(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('ejendomme').insert({
      kunde_id: kunde.id,
      navn: ejNavn.trim() || ejAdresse,
      adresse: ejAdresse.trim() || null,
      postnr: ejPostnr.trim() || null,
      intern_indkoeb_findes: false,
    })
    if (error) { setFejl(error.message); return }
    setEjNavn(''); setEjAdresse(''); setEjPostnr(''); setDawaValgt(false)
    setVisForm(false)
    hentEjendomme()
  }

  async function handleGemKunde(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('kunder').update({
      navn: editNavn.trim(),
      kontaktperson: editKontaktperson.trim() || null,
      email: editEmail.trim() || null,
      telefon: editTelefon.trim() || null,
    }).eq('id', kunde.id)
    if (error) { setFejl(error.message); return }
    kunde.navn = editNavn.trim()
    kunde.kontaktperson = editKontaktperson.trim() || null
    kunde.email = editEmail.trim() || null
    kunde.telefon = editTelefon.trim() || null
    setRedigerKunde(false)
  }

  return (
    <div className="page">
      <button className="tilbage-knap" onClick={onTilbage}>← Tilbage til kunder</button>

      {redigerKunde ? (
        <form className="inline-form kunde-rediger-form" onSubmit={handleGemKunde}>
          <input value={editNavn} onChange={(e) => setEditNavn(e.target.value)} placeholder="Firmanavn" required />
          <input value={editKontaktperson} onChange={(e) => setEditKontaktperson(e.target.value)} placeholder="Kontaktperson" />
          <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="E-mail" />
          <input value={editTelefon} onChange={(e) => setEditTelefon(e.target.value)} placeholder="Telefon" />
          <button type="submit">Gem</button>
          <button type="button" onClick={() => setRedigerKunde(false)}>Annuller</button>
        </form>
      ) : (
        <div className="page-header">
          <div className="kunde-header-info">
            <h2>{kunde.navn}</h2>
            <div className="kunde-header-meta">
              {kunde.cvr && <span>CVR {kunde.cvr}</span>}
              {kunde.kontaktperson && <span>{kunde.kontaktperson}</span>}
              {kunde.email && <a href={`mailto:${kunde.email}`}>{kunde.email}</a>}
              {kunde.telefon && <span>{kunde.telefon}</span>}
              {(kunde.adresse || kunde.by) && (
                <span>{[kunde.adresse, kunde.postnr && kunde.by ? `${kunde.postnr} ${kunde.by}` : kunde.by].filter(Boolean).join(', ')}</span>
              )}
            </div>
          </div>
          <button className="rediger-knap" onClick={() => setRedigerKunde(true)}>Rediger</button>
        </div>
      )}

      {fejl && <p className="fejl-besked">{fejl}</p>}

      <section className="modul-sektion">
        <div className="page-header">
          <h3>Ejendomme</h3>
          <button onClick={() => setVisForm((v) => !v)}>
            {visForm ? 'Annuller' : '+ Tilføj ejendom'}
          </button>
        </div>

        {visForm && (
          <form className="ejendom-opret-form" onSubmit={handleOpretEjendom}>
            <div>
              <label className="form-label">Adresse (søg)</label>
              <DawaAdresseSoeg onValgt={handleDawaValgt} placeholder="Skriv adresse og vælg fra listen…" />
              {dawaValgt && <p className="dawa-bekraeft">✓ {ejAdresse}</p>}
            </div>
            <div>
              <label className="form-label">Ejendomsnavn (valgfrit — udfyldes automatisk)</label>
              <input
                value={ejNavn}
                onChange={(e) => setEjNavn(e.target.value)}
                placeholder={ejAdresse || 'F.eks. Tingvej 10, blok A'}
              />
            </div>
            <button type="submit" disabled={!ejAdresse && !ejNavn}>Tilføj ejendom</button>
          </form>
        )}

        {loading ? (
          <p>Indlæser…</p>
        ) : ejendomme.length === 0 ? (
          <p className="tom-tilstand">Ingen ejendomme endnu for denne kunde.</p>
        ) : (
          <ul className="ejendoms-liste">
            {ejendomme.map((ej) => (
              <li key={ej.id} className="ejendoms-kort" onClick={() => onSelectEjendom(ej)}>
                <strong>{ej.navn}</strong>
                {ej.adresse && ej.adresse !== ej.navn && (
                  <span className="ejendoms-adresse">{ej.adresse}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

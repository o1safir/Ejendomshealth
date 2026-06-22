import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Kunde } from '../types'

interface Props {
  onSelectKunde: (kunde: Kunde) => void
}

interface CVRData {
  name: string
  address: string
  zipcode: string
  city: string
  phone?: string
  email?: string
  type?: string
}

export default function KunderListePage({ onSelectKunde }: Props) {
  const [kunder, setKunder] = useState<Kunde[]>([])
  const [antalEjendomme, setAntalEjendomme] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [visForm, setVisForm] = useState(false)
  const [fejl, setFejl] = useState<string | null>(null)

  // Formfelter
  const [cvr, setCvr] = useState('')
  const [cvrLoading, setCvrLoading] = useState(false)
  const [cvrFejl, setCvrFejl] = useState<string | null>(null)
  const [navn, setNavn] = useState('')
  const [adresse, setAdresse] = useState('')
  const [postnr, setPostnr] = useState('')
  const [by, setBy] = useState('')
  const [telefon, setTelefon] = useState('')
  const [email, setEmail] = useState('')
  const [kontaktperson, setKontaktperson] = useState('')
  const [branche, setBranche] = useState('')

  async function hentKunder() {
    setLoading(true)
    const [kunderRes, ejRes] = await Promise.all([
      supabase.from('kunder').select('*').order('navn'),
      supabase.from('ejendomme').select('kunde_id').not('kunde_id', 'is', null),
    ])
    if (kunderRes.error) { setFejl(kunderRes.error.message); setLoading(false); return }
    setKunder(kunderRes.data ?? [])
    const tæl: Record<string, number> = {}
    for (const e of ejRes.data ?? []) {
      if (e.kunde_id) tæl[e.kunde_id] = (tæl[e.kunde_id] ?? 0) + 1
    }
    setAntalEjendomme(tæl)
    setLoading(false)
  }

  useEffect(() => { hentKunder() }, [])

  async function hentCVR() {
    const renset = cvr.replace(/\s/g, '')
    if (renset.length !== 8) { setCvrFejl('CVR-nummeret skal være 8 cifre'); return }
    setCvrLoading(true); setCvrFejl(null)
    try {
      const res = await fetch(`https://cvrapi.dk/api?search=${renset}&country=dk`)
      if (!res.ok) throw new Error('CVR ikke fundet')
      const data: CVRData = await res.json()
      if ((data as { error?: string }).error) throw new Error('CVR ikke fundet')
      setNavn(data.name ?? '')
      setAdresse(data.address ?? '')
      setPostnr(data.zipcode ?? '')
      setBy(data.city ?? '')
      setTelefon(data.phone ?? '')
      setEmail(data.email ?? '')
      setBranche(data.type ?? '')
    } catch {
      setCvrFejl('Kunne ikke hente CVR-data — tjek nummeret og prøv igen')
    } finally {
      setCvrLoading(false)
    }
  }

  function nulstilForm() {
    setCvr(''); setNavn(''); setAdresse(''); setPostnr(''); setBy('')
    setTelefon(''); setEmail(''); setKontaktperson(''); setBranche('')
    setCvrFejl(null)
  }

  async function handleOpret(e: FormEvent) {
    e.preventDefault()
    if (!navn.trim()) return
    const { error } = await supabase.from('kunder').insert({
      cvr: cvr.replace(/\s/g, '') || null,
      navn: navn.trim(),
      adresse: adresse.trim() || null,
      postnr: postnr.trim() || null,
      by: by.trim() || null,
      telefon: telefon.trim() || null,
      email: email.trim() || null,
      kontaktperson: kontaktperson.trim() || null,
      branche: branche.trim() || null,
    })
    if (error) { setFejl(error.message); return }
    nulstilForm()
    setVisForm(false)
    hentKunder()
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Kunder</h2>
        <button onClick={() => { setVisForm((v) => !v); if (visForm) nulstilForm() }}>
          {visForm ? 'Annuller' : '+ Ny kunde'}
        </button>
      </div>

      {fejl && <p className="fejl-besked">{fejl}</p>}

      {visForm && (
        <form className="kunde-form" onSubmit={handleOpret}>
          <div className="cvr-soeg-raekke">
            <div className="cvr-input-gruppe">
              <label className="form-label">CVR-nummer</label>
              <input
                placeholder="12345678"
                value={cvr}
                onChange={(e) => setCvr(e.target.value)}
                maxLength={10}
                className="cvr-input"
              />
            </div>
            <button type="button" className="cvr-hent-knap" onClick={hentCVR} disabled={cvrLoading}>
              {cvrLoading ? 'Henter…' : 'Hent fra CVR'}
            </button>
          </div>
          {cvrFejl && <p className="form-fejl">{cvrFejl}</p>}

          <div className="form-grid-2">
            <div>
              <label className="form-label">Firmanavn *</label>
              <input value={navn} onChange={(e) => setNavn(e.target.value)} required placeholder="Firma A/S" />
            </div>
            <div>
              <label className="form-label">Branche</label>
              <input value={branche} onChange={(e) => setBranche(e.target.value)} placeholder="A/S, K/S, …" />
            </div>
            <div>
              <label className="form-label">Adresse</label>
              <input value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Vesterbrogade 10" />
            </div>
            <div className="form-grid-2-inner">
              <div>
                <label className="form-label">Postnr.</label>
                <input value={postnr} onChange={(e) => setPostnr(e.target.value)} placeholder="1234" />
              </div>
              <div>
                <label className="form-label">By</label>
                <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="København V" />
              </div>
            </div>
            <div>
              <label className="form-label">Kontaktperson</label>
              <input value={kontaktperson} onChange={(e) => setKontaktperson(e.target.value)} placeholder="Anders Jensen" />
            </div>
            <div>
              <label className="form-label">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kontakt@firma.dk" />
            </div>
            <div>
              <label className="form-label">Telefon</label>
              <input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="12 34 56 78" />
            </div>
          </div>

          <div className="form-knapper">
            <button type="submit">Opret kunde</button>
            <button type="button" className="slet-knap" onClick={() => { setVisForm(false); nulstilForm() }}>Annuller</button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Indlæser…</p>
      ) : kunder.length === 0 ? (
        <p className="tom-tilstand">Ingen kunder endnu. Opret den første for at komme i gang.</p>
      ) : (
        <ul className="kunde-liste">
          {kunder.map((k) => (
            <li key={k.id} className="kunde-kort" onClick={() => onSelectKunde(k)}>
              <div className="kunde-kort-hoved">
                <strong>{k.navn}</strong>
                {k.cvr && <span className="kunde-cvr">CVR {k.cvr}</span>}
              </div>
              <div className="kunde-kort-meta">
                {(k.adresse || k.by) && (
                  <span>{[k.adresse, k.postnr && k.by ? `${k.postnr} ${k.by}` : k.by].filter(Boolean).join(', ')}</span>
                )}
                {k.kontaktperson && <span>{k.kontaktperson}</span>}
                <span className="kunde-ejendoms-tal">
                  {antalEjendomme[k.id] ?? 0} ejendom{(antalEjendomme[k.id] ?? 0) !== 1 ? 'me' : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

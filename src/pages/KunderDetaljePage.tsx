import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import DawaAdresseSoeg, { type ValgtAdresse } from '../components/DawaAdresseSoeg'
import type { Ejendom, Kunde } from '../types'

interface Props {
  kunde: Kunde
  onTilbage: () => void
  onSelectEjendom: (ejendom: Ejendom) => void
}

interface BBRData {
  areal_m2?: number | null
  opfoerelsesaar?: number | null
  antal_enheder?: number | null
  bbr_nr?: string | null
  matrikel_nr?: string | null
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
  const [ejAreal, setEjAreal] = useState('')
  const [ejOpfoerelsesaar, setEjOpfoerelsesaar] = useState('')
  const [ejAntalEnheder, setEjAntalEnheder] = useState('')
  const [ejBbrNr, setEjBbrNr] = useState('')
  const [ejMatrikelNr, setEjMatrikelNr] = useState('')
  const [dawaValgt, setDawaValgt] = useState(false)
  const [bbrLoading, setBbrLoading] = useState(false)
  const [bbrStatus, setBbrStatus] = useState<'idle' | 'ok' | 'tom' | 'fejl'>('idle')

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

  async function handleDawaValgt(a: ValgtAdresse) {
    setEjAdresse(a.fuld_tekst)
    setEjPostnr(a.postnr)
    if (!ejNavn) setEjNavn(a.fuld_tekst)
    setDawaValgt(true)
    setBbrStatus('idle')

    // Kald BBR-proxy via vores backend
    const rapportUrl = import.meta.env.VITE_RAPPORT_SERVICE_URL
    if (!rapportUrl) return

    setBbrLoading(true)
    try {
      const res = await fetch(
        `${rapportUrl}/bbr-opslag?id=${encodeURIComponent(a.adgangsadresseid)}&adresse_id=${encodeURIComponent(a.adresse_id)}`
      )
      if (!res.ok) { setBbrStatus('fejl'); return }
      const data: BBRData = await res.json()

      if (!data.areal_m2 && !data.opfoerelsesaar) {
        setBbrStatus('tom')
      } else {
        setEjAreal(data.areal_m2?.toString() ?? '')
        setEjOpfoerelsesaar(data.opfoerelsesaar?.toString() ?? '')
        setEjAntalEnheder(data.antal_enheder?.toString() ?? '')
        setEjBbrNr(data.bbr_nr ?? '')
        setEjMatrikelNr(data.matrikel_nr ?? '')
        setBbrStatus('ok')
      }
    } catch {
      setBbrStatus('fejl')
    } finally {
      setBbrLoading(false)
    }
  }

  function nulstilEjendomForm() {
    setEjNavn(''); setEjAdresse(''); setEjPostnr('')
    setEjAreal(''); setEjOpfoerelsesaar(''); setEjAntalEnheder('')
    setEjBbrNr(''); setEjMatrikelNr('')
    setDawaValgt(false); setBbrStatus('idle')
  }

  async function handleOpretEjendom(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('ejendomme').insert({
      kunde_id: kunde.id,
      navn: ejNavn.trim() || ejAdresse,
      adresse: ejAdresse.trim() || null,
      postnr: ejPostnr.trim() || null,
      areal_m2: ejAreal ? Number(ejAreal) : null,
      opfoerelsesaar: ejOpfoerelsesaar ? Number(ejOpfoerelsesaar) : null,
      antal_enheder: ejAntalEnheder ? Number(ejAntalEnheder) : null,
      bbr_nr: ejBbrNr.trim() || null,
      matrikel_nr: ejMatrikelNr.trim() || null,
      intern_indkoeb_findes: false,
    })
    if (error) { setFejl(error.message); return }
    nulstilEjendomForm()
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
          <button onClick={() => { setVisForm((v) => !v); if (visForm) nulstilEjendomForm() }}>
            {visForm ? 'Annuller' : '+ Tilføj ejendom'}
          </button>
        </div>

        {visForm && (
          <form className="ejendom-opret-form" onSubmit={handleOpretEjendom}>

            <div>
              <label className="form-label">Adresse *</label>
              <DawaAdresseSoeg onValgt={handleDawaValgt} placeholder="Begynd at skrive adresse…" />
            </div>

            {/* BBR-status banner */}
            {bbrLoading && (
              <div className="bbr-status bbr-henter">Henter BBR-data…</div>
            )}
            {!bbrLoading && bbrStatus === 'ok' && (
              <div className="bbr-status bbr-ok">✓ BBR-data hentet automatisk — rediger felterne nedenfor hvis nødvendigt</div>
            )}
            {!bbrLoading && bbrStatus === 'tom' && (
              <div className="bbr-status bbr-advarsel">BBR: ingen bygning fundet på denne adresse — udfyld manuelt</div>
            )}
            {!bbrLoading && bbrStatus === 'fejl' && (
              <div className="bbr-status bbr-advarsel">BBR-opslag er ikke konfigureret endnu — udfyld manuelt</div>
            )}

            {dawaValgt && (
              <>
                <div>
                  <label className="form-label">Ejendomsnavn (valgfrit)</label>
                  <input
                    value={ejNavn}
                    onChange={(e) => setEjNavn(e.target.value)}
                    placeholder={ejAdresse || 'F.eks. Tingvej 10, blok A'}
                  />
                </div>

                <div className="bbr-felter-grid">
                  <div>
                    <label className="form-label">Samlet areal (m²)</label>
                    <input
                      type="number"
                      value={ejAreal}
                      onChange={(e) => setEjAreal(e.target.value)}
                      placeholder="–"
                      className={bbrStatus === 'ok' && ejAreal ? 'bbr-autofyldt' : ''}
                    />
                  </div>
                  <div>
                    <label className="form-label">Opførelseår</label>
                    <input
                      type="number"
                      value={ejOpfoerelsesaar}
                      onChange={(e) => setEjOpfoerelsesaar(e.target.value)}
                      placeholder="–"
                      className={bbrStatus === 'ok' && ejOpfoerelsesaar ? 'bbr-autofyldt' : ''}
                    />
                  </div>
                  <div>
                    <label className="form-label">Antal enheder</label>
                    <input
                      type="number"
                      value={ejAntalEnheder}
                      onChange={(e) => setEjAntalEnheder(e.target.value)}
                      placeholder="–"
                      className={bbrStatus === 'ok' && ejAntalEnheder ? 'bbr-autofyldt' : ''}
                    />
                  </div>
                  <div>
                    <label className="form-label">BBR-nr.</label>
                    <input
                      value={ejBbrNr}
                      onChange={(e) => setEjBbrNr(e.target.value)}
                      placeholder="–"
                      className={bbrStatus === 'ok' && ejBbrNr ? 'bbr-autofyldt' : ''}
                    />
                  </div>
                  <div>
                    <label className="form-label">Matrikelnr.</label>
                    <input
                      value={ejMatrikelNr}
                      onChange={(e) => setEjMatrikelNr(e.target.value)}
                      placeholder="–"
                      className={bbrStatus === 'ok' && ejMatrikelNr ? 'bbr-autofyldt' : ''}
                    />
                  </div>
                </div>
              </>
            )}

            <button type="submit" disabled={!ejAdresse && !ejNavn}>
              Tilføj ejendom
            </button>
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
                <div className="ejendom-kort-hoved">
                  <strong>{ej.navn}</strong>
                  <div className="ejendom-kort-chips">
                    {ej.areal_m2 && <span className="ejendom-chip">{ej.areal_m2.toLocaleString('da-DK')} m²</span>}
                    {ej.opfoerelsesaar && <span className="ejendom-chip">{ej.opfoerelsesaar}</span>}
                    {ej.antal_enheder && <span className="ejendom-chip">{ej.antal_enheder} enh.</span>}
                  </div>
                </div>
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

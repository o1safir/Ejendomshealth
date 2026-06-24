import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import DawaAdresseSoeg, { type ValgtAdresse } from '../components/DawaAdresseSoeg'
import type { BesparelseForslag, Ejendom, Kunde } from '../types'

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
  const [ejEnergimaerke, setEjEnergimaerke] = useState('')
  const [ejEnergimaerkeGyldigt, setEjEnergimaerkeGyldigt] = useState('')
  const [ejEnergibehovKwhM2, setEjEnergibehovKwhM2] = useState<number | null>(null)
  const [ejCo2UdledningKg, setEjCo2UdledningKg] = useState<number | null>(null)
  const [ejOpvarmningsform, setEjOpvarmningsform] = useState('')
  const [ejBesparelsesforslag, setEjBesparelsesforslag] = useState<BesparelseForslag[] | null>(null)
  const [dawaValgt, setDawaValgt] = useState(false)
  const [bbrLoading, setBbrLoading] = useState(false)
  const [bbrStatus, setBbrStatus] = useState<'idle' | 'ok' | 'tom' | 'fejl'>('idle')
  const [emLoading, setEmLoading] = useState(false)
  const [emStatus, setEmStatus] = useState<'idle' | 'ok' | 'tom'>('idle')

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
    setEmStatus('idle')

    const rapportUrl = import.meta.env.VITE_RAPPORT_SERVICE_URL
    if (!rapportUrl) return

    // BBR og energimærke køres parallelt
    setBbrLoading(true)
    setEmLoading(true)

    const [bbrRes, emRes] = await Promise.allSettled([
      fetch(`${rapportUrl}/bbr-opslag?id=${encodeURIComponent(a.adgangsadresseid)}&adresse_id=${encodeURIComponent(a.adresse_id)}`),
      fetch(`${rapportUrl}/energimaerke-opslag?vejnavn=${encodeURIComponent(a.vejnavn)}&husnr=${encodeURIComponent(a.husnr)}&postnr=${encodeURIComponent(a.postnr)}`),
    ])

    // BBR
    setBbrLoading(false)
    if (bbrRes.status === 'fulfilled' && bbrRes.value.ok) {
      const data: BBRData = await bbrRes.value.json()
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
    } else {
      setBbrStatus('fejl')
    }

    // Energimærke
    setEmLoading(false)
    if (emRes.status === 'fulfilled' && emRes.value.ok) {
      const emData: {
        label?: string
        gyldigt_til?: string
        energibehov_kwh_m2?: number
        co2_udledning_kg?: number
        opvarmningsform?: string
        besparelsesforslag?: BesparelseForslag[]
      } = await emRes.value.json()
      if (emData.label) {
        setEjEnergimaerke(emData.label)
        setEjEnergimaerkeGyldigt(emData.gyldigt_til ?? '')
        setEjEnergibehovKwhM2(emData.energibehov_kwh_m2 ?? null)
        setEjCo2UdledningKg(emData.co2_udledning_kg ?? null)
        setEjOpvarmningsform(emData.opvarmningsform ?? '')
        setEjBesparelsesforslag(emData.besparelsesforslag ?? null)
        setEmStatus('ok')
      } else {
        setEmStatus('tom')
      }
    } else {
      setEmStatus('tom')
    }
  }

  function nulstilEjendomForm() {
    setEjNavn(''); setEjAdresse(''); setEjPostnr('')
    setEjAreal(''); setEjOpfoerelsesaar(''); setEjAntalEnheder('')
    setEjBbrNr(''); setEjMatrikelNr('')
    setEjEnergimaerke(''); setEjEnergimaerkeGyldigt('')
    setEjEnergibehovKwhM2(null); setEjCo2UdledningKg(null)
    setEjOpvarmningsform(''); setEjBesparelsesforslag(null)
    setDawaValgt(false); setBbrStatus('idle'); setEmStatus('idle')
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
      energimaerke: ejEnergimaerke.trim() || null,
      energimaerke_gyldigt_til: ejEnergimaerkeGyldigt || null,
      energibehov_kwh_m2: ejEnergibehovKwhM2,
      co2_udledning_kg: ejCo2UdledningKg,
      opvarmningsform: ejOpvarmningsform.trim() || null,
      besparelsesforslag: ejBesparelsesforslag,
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

            {/* Status-bannere */}
            {(bbrLoading || emLoading) && (
              <div className="bbr-status bbr-henter">Henter BBR{emLoading ? ' og energimærke' : ''}…</div>
            )}
            {!bbrLoading && !emLoading && bbrStatus === 'ok' && (
              <div className="bbr-status bbr-ok">✓ BBR hentet automatisk</div>
            )}
            {!bbrLoading && !emLoading && bbrStatus === 'tom' && (
              <div className="bbr-status bbr-advarsel">BBR: ingen bygning fundet — udfyld manuelt</div>
            )}
            {!bbrLoading && !emLoading && bbrStatus === 'fejl' && (
              <div className="bbr-status bbr-advarsel">BBR-opslag ikke konfigureret — udfyld manuelt</div>
            )}
            {!emLoading && emStatus === 'ok' && ejEnergimaerke && (
              <div className="bbr-status bbr-ok">
                Energimærke <span className={`em-badge em-${ejEnergimaerke.charAt(0).toLowerCase()}`}>{ejEnergimaerke}</span>
                {ejEnergimaerkeGyldigt && ` · gyldigt til ${new Date(ejEnergimaerkeGyldigt).toLocaleDateString('da-DK')}`}
              </div>
            )}
            {!emLoading && emStatus === 'tom' && (
              <div className="bbr-status" style={{ color: 'var(--text-secondary)' }}>Intet energimærke registreret</div>
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
                    {ej.energimaerke && <span className={`ejendom-chip em-badge em-${ej.energimaerke.charAt(0).toLowerCase()}`}>{ej.energimaerke}</span>}
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

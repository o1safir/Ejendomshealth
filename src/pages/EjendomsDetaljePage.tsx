import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { beregnBesparelse } from '../lib/besparelseBeregning'
import { AFTALE_KATEGORIER } from '../types'
import type { Aftale, Brand, Ejendom } from '../types'

interface Props {
  ejendom: Ejendom
  onTilbage: () => void
}

const URGENCY_LABEL: Record<string, string> = {
  ingen: 'Intet nævneværdigt potentiale',
  lav: 'Muligt besparelsespotentiale',
  middel: 'Klart besparelsespotentiale',
  høj: 'Betydeligt besparelsespotentiale',
}

export default function EjendomsDetaljePage({ ejendom, onTilbage }: Props) {
  const [aftaler, setAftaler] = useState<Aftale[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandNavn, setSelectedBrandNavn] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [visForm, setVisForm] = useState(false)
  const [genererer, setGenererer] = useState(false)
  const [fejl, setFejl] = useState<string | null>(null)

  // Form-state for ny aftale
  const [kategori, setKategori] = useState<string>(AFTALE_KATEGORIER[0])
  const [leverandoer, setLeverandoer] = useState('')
  const [pris, setPris] = useState('')
  const [genforhandlet, setGenforhandlet] = useState('')
  const [internIndkoeb, setInternIndkoeb] = useState(false)

  async function hentData() {
    setLoading(true)
    const [aftalerRes, brandsRes] = await Promise.all([
      supabase
        .from('aftaler')
        .select('*')
        .eq('ejendom_id', ejendom.id)
        .order('created_at', { ascending: false }),
      supabase.from('brands').select('*').order('navn'),
    ])

    if (aftalerRes.error) setFejl(aftalerRes.error.message)
    else setAftaler(aftalerRes.data ?? [])

    if (!brandsRes.error && brandsRes.data && brandsRes.data.length > 0) {
      setBrands(brandsRes.data)
      setSelectedBrandNavn((prev) => prev || brandsRes.data[0].navn)
    }

    setLoading(false)
  }

  useEffect(() => {
    hentData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejendom.id])

  async function handleOpretAftale(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('aftaler').insert({
      ejendom_id: ejendom.id,
      kategori,
      leverandoer: leverandoer.trim() || null,
      nuvaerende_pris: pris ? Number(pris) : null,
      sidst_genforhandlet: genforhandlet || null,
      intern_indkoeb_findes: internIndkoeb,
    })

    if (error) {
      setFejl(error.message)
      return
    }

    setLeverandoer('')
    setPris('')
    setGenforhandlet('')
    setInternIndkoeb(false)
    setVisForm(false)
    hentData()
  }

  async function handleSletAftale(id: string) {
    const { error } = await supabase.from('aftaler').delete().eq('id', id)
    if (error) setFejl(error.message)
    else hentData()
  }

  async function handleGenererRapport() {
    setGenererer(true)
    setFejl(null)
    try {
      const rapportServiceUrl = import.meta.env.VITE_RAPPORT_SERVICE_URL
      if (!rapportServiceUrl) {
        setFejl(
          'VITE_RAPPORT_SERVICE_URL er ikke sat. Rapport-servicen skal deployes først (se report_service/README.md).'
        )
        return
      }

      const res = await fetch(`${rapportServiceUrl}/generer-rapport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ejendom_id: ejendom.id,
          rapport_type: 'besparelse',
          brand_navn: selectedBrandNavn || undefined,
        }),
      })

      if (!res.ok) {
        throw new Error(`Rapport-service svarede med status ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `besparelsesrapport-${ejendom.navn.replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setFejl(err instanceof Error ? err.message : 'Ukendt fejl ved rapportgenerering')
    } finally {
      setGenererer(false)
    }
  }

  const resultat = beregnBesparelse(aftaler)

  return (
    <div className="page">
      <button className="tilbage-knap" onClick={onTilbage}>
        ← Tilbage til ejendomme
      </button>

      <div className="page-header">
        <h2>{ejendom.navn}</h2>
        {ejendom.adresse && <span className="ejendoms-adresse">{ejendom.adresse}</span>}
      </div>

      {fejl && <p className="fejl-besked">{fejl}</p>}

      <section className="modul-sektion">
        <div className="page-header">
          <h3>Aftaler & leverandører</h3>
          <button onClick={() => setVisForm((v) => !v)}>
            {visForm ? 'Annuller' : '+ Tilføj aftale'}
          </button>
        </div>

        {visForm && (
          <form className="inline-form aftale-form" onSubmit={handleOpretAftale}>
            <select value={kategori} onChange={(e) => setKategori(e.target.value)}>
              {AFTALE_KATEGORIER.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              placeholder="Leverandør"
              value={leverandoer}
              onChange={(e) => setLeverandoer(e.target.value)}
            />
            <input
              type="number"
              placeholder="Årlig pris (kr.)"
              value={pris}
              onChange={(e) => setPris(e.target.value)}
            />
            <label className="dato-label">
              Sidst genforhandlet
              <input
                type="date"
                value={genforhandlet}
                onChange={(e) => setGenforhandlet(e.target.value)}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={internIndkoeb}
                onChange={(e) => setInternIndkoeb(e.target.checked)}
              />
              Intern indkøbsfunktion findes
            </label>
            <button type="submit">Tilføj</button>
          </form>
        )}

        {loading ? (
          <p>Indlæser…</p>
        ) : aftaler.length === 0 ? (
          <p className="tom-tilstand">
            Ingen aftaler registreret endnu. Tilføj mindst én for at se besparelsesoverslag.
          </p>
        ) : (
          <table className="aftale-tabel">
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Leverandør</th>
                <th>Pris/år</th>
                <th>Genforhandlet</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {aftaler.map((a) => (
                <tr key={a.id}>
                  <td>{a.kategori}</td>
                  <td>{a.leverandoer ?? '–'}</td>
                  <td>{a.nuvaerende_pris?.toLocaleString('da-DK') ?? '–'} kr.</td>
                  <td>
                    {a.sidst_genforhandlet
                      ? new Date(a.sidst_genforhandlet).toLocaleDateString('da-DK')
                      : '–'}
                  </td>
                  <td>
                    <button className="slet-knap" onClick={() => handleSletAftale(a.id)}>
                      Slet
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {resultat && (
        <section className="resultat-boks">
          <h3>Besparelsesoverslag (live)</h3>
          <p className="urgency-label">{URGENCY_LABEL[resultat.urgency]}</p>
          <div className="resultat-grid">
            <div>
              <span className="resultat-label">Estimeret besparelse</span>
              <strong>
                {resultat.minBesparelse.toLocaleString('da-DK')} –{' '}
                {resultat.maxBesparelse.toLocaleString('da-DK')} kr./år
              </strong>
            </div>
            <div>
              <span className="resultat-label">Besparelsesprocent</span>
              <strong>{resultat.besparelsesProcentSpaend}</strong>
            </div>
            <div>
              <span className="resultat-label">Core Partners honorar (20%)</span>
              <strong>{resultat.honorar.toLocaleString('da-DK')} kr.</strong>
            </div>
            <div>
              <span className="resultat-label">Netto første år</span>
              <strong>{resultat.netto.toLocaleString('da-DK')} kr.</strong>
            </div>
          </div>
          <p className="resultat-disclaimer">
            Dette er et hurtigt overslag beregnet i browseren. Den endelige PDF-rapport
            genereres af rapport-servicen med samme beregningslogik.
          </p>

          {brands.length > 1 && (
            <div className="brand-valg">
              <label htmlFor="brand-select">Brand på rapport</label>
              <select
                id="brand-select"
                value={selectedBrandNavn}
                onChange={(e) => setSelectedBrandNavn(e.target.value)}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.navn}>
                    {b.navn}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button onClick={handleGenererRapport} disabled={genererer}>
            {genererer ? 'Genererer PDF…' : 'Generér rapport (PDF)'}
          </button>
        </section>
      )}
    </div>
  )
}

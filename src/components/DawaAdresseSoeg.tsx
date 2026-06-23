import { useState, useEffect, useRef } from 'react'

interface DawaForslag {
  tekst: string
  adresse: {
    id: string
    vejnavn: string
    husnr: string
    etage: string | null
    doer: string | null
    postnr: string
    postnrnavn: string
    adgangsadresseid: string
  }
}

export interface ValgtAdresse {
  fuld_tekst: string
  vejnavn: string
  husnr: string
  postnr: string
  postnrnavn: string
  adresse_id: string        // specifik lejlighedsadresse-ID (bruges til BBR enhed-opslag)
  adgangsadresseid: string  // bygningens adgangspunkt-ID (bruges til BBR bygning-opslag)
}

interface Props {
  onValgt: (adresse: ValgtAdresse) => void
  initialVaerdi?: string
  placeholder?: string
}

export default function DawaAdresseSoeg({ onValgt, initialVaerdi = '', placeholder = 'Søg adresse…' }: Props) {
  const [soeg, setSoeg] = useState(initialVaerdi)
  const [forslag, setForslag] = useState<DawaForslag[]>([])
  const [visForslag, setVisForslag] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const valgtRef = useRef(false)

  useEffect(() => {
    if (valgtRef.current) { valgtRef.current = false; return }
    if (soeg.length < 3) { setForslag([]); setVisForslag(false); return }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `https://api.dataforsyningen.dk/adresser/autocomplete?q=${encodeURIComponent(soeg)}&per_side=7&fuzzy=`
        )
        if (res.ok) {
          const data: DawaForslag[] = await res.json()
          setForslag(data)
          setVisForslag(data.length > 0)
        }
      } finally {
        setLoading(false)
      }
    }, 280)
  }, [soeg])

  function vaelg(f: DawaForslag) {
    valgtRef.current = true
    setSoeg(f.tekst)
    setVisForslag(false)
    setForslag([])
    onValgt({
      fuld_tekst: f.tekst,
      vejnavn: f.adresse.vejnavn,
      husnr: f.adresse.husnr,
      postnr: f.adresse.postnr,
      postnrnavn: f.adresse.postnrnavn,
      adresse_id: f.adresse.id,
      adgangsadresseid: f.adresse.adgangsadresseid,
    })
  }

  return (
    <div className="dawa-wrapper">
      <input
        className="dawa-input"
        value={soeg}
        onChange={(e) => setSoeg(e.target.value)}
        placeholder={placeholder}
        onFocus={() => forslag.length > 0 && setVisForslag(true)}
        onBlur={() => setTimeout(() => setVisForslag(false), 160)}
        autoComplete="off"
      />
      {loading && <span className="dawa-spinner">…</span>}
      {visForslag && (
        <ul className="dawa-forslag">
          {forslag.map((f) => (
            <li key={f.adresse.id} onMouseDown={() => vaelg(f)}>
              {f.tekst}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

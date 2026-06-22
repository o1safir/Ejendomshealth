import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Ejendom } from '../types'

interface Props {
  onSelect: (ejendom: Ejendom) => void
}

export default function EjendomsListePage({ onSelect }: Props) {
  const [ejendomme, setEjendomme] = useState<Ejendom[]>([])
  const [loading, setLoading] = useState(true)
  const [visOpretForm, setVisOpretForm] = useState(false)
  const [navn, setNavn] = useState('')
  const [adresse, setAdresse] = useState('')
  const [fejl, setFejl] = useState<string | null>(null)

  async function hentEjendomme() {
    setLoading(true)
    const { data, error } = await supabase
      .from('ejendomme')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      setFejl(error.message)
    } else {
      setEjendomme(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    hentEjendomme()
  }, [])

  async function handleOpret(e: FormEvent) {
    e.preventDefault()
    if (!navn.trim()) return

    const { error } = await supabase.from('ejendomme').insert({
      navn: navn.trim(),
      adresse: adresse.trim() || null,
    })

    if (error) {
      setFejl(error.message)
      return
    }

    setNavn('')
    setAdresse('')
    setVisOpretForm(false)
    hentEjendomme()
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>Ejendomme</h2>
        <button onClick={() => setVisOpretForm((v) => !v)}>
          {visOpretForm ? 'Annuller' : '+ Ny ejendom'}
        </button>
      </div>

      {fejl && <p className="fejl-besked">{fejl}</p>}

      {visOpretForm && (
        <form className="inline-form" onSubmit={handleOpret}>
          <input
            placeholder="Ejendomsnavn (f.eks. Tingvej 10, København S)"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            required
          />
          <input
            placeholder="Adresse (valgfrit)"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
          />
          <button type="submit">Opret</button>
        </form>
      )}

      {loading ? (
        <p>Indlæser…</p>
      ) : ejendomme.length === 0 ? (
        <p className="tom-tilstand">
          Ingen ejendomme endnu. Opret den første for at komme i gang.
        </p>
      ) : (
        <ul className="ejendoms-liste">
          {ejendomme.map((e) => (
            <li key={e.id} onClick={() => onSelect(e)} className="ejendoms-kort">
              <strong>{e.navn}</strong>
              {e.adresse && <span className="ejendoms-adresse">{e.adresse}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

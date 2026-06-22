// Besparelsesberegning — matcher Core Partners hjemmeside (corepartners.html) 1:1.
// Python-versionen (report_service/besparelse_beregning.py) SKAL matche denne logik.
//
// Ændres kun i BEGGE filer på én gang — logikken er duplikeret by design
// (frontend til live overslag, Python til autoritativ PDF-beregning).

import type { Aftale } from '../types'

export interface BesparelsesResultat {
  minBesparelse: number
  maxBesparelse: number
  medianBesparelse: number
  besparelsesProcentSpaend: string
  honorar: number
  netto: number
  urgency: 'ingen' | 'lav' | 'middel' | 'høj'
}

// Servicemix-vægt pr. kategori — højere vægt = historisk større optimeringspotentiale
const KATEGORI_VAEGT: Record<string, number> = {
  'Forsikringer':       0.018,
  'Serviceaftaler':     0.012,
  'Vedligehold':        0.012,
  'Vagt & sikkerhed':   0.012,
  'Rengøring':          0.010,
  'IT & telefoni':      0.008,
  'Andet':              0.008,
  'Energi & forsyning': 0.004,
}

function aarSidenGenforhandling(dato: string | null): number | null {
  if (!dato) return null
  return (Date.now() - new Date(dato).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
}

function rateForAlder(aar: number): number {
  if (aar < 1) return 0.02
  if (aar < 2) return 0.05
  if (aar < 4) return 0.09
  return 0.13
}

function urgencyForRf(rf: number): BesparelsesResultat['urgency'] {
  if (rf < 0.06) return 'ingen'
  if (rf < 0.10) return 'lav'
  if (rf < 0.14) return 'middel'
  return 'høj'
}

export function beregnBesparelse(aftaler: Aftale[], internIndkoeb: boolean): BesparelsesResultat | null {
  if (aftaler.length === 0) return null

  const total = aftaler.reduce((sum, a) => sum + (a.nuvaerende_pris ?? 0), 0)
  if (total <= 0) return null

  // Servicemix-vægt (cw): vægtet gennemsnit af kategoriernes bidrag ift. omsætning
  const cwTaeller = aftaler.reduce((sum, a) => {
    const pris = a.nuvaerende_pris ?? 0
    const vaegt = KATEGORI_VAEGT[a.kategori] ?? 0.008
    return sum + pris * vaegt
  }, 0)
  const cw = cwTaeller / total

  // Baserate fra ældste genforhandling (konservativt: driver procenten op)
  const aldre = aftaler
    .map((a) => aarSidenGenforhandling(a.sidst_genforhandlet))
    .filter((a): a is number => a !== null)
  const aeldsteAar = aldre.length > 0 ? Math.max(...aldre) : 4
  const rate = rateForAlder(aeldsteAar)

  // Indkøbsfunktionsjustering (ejendoms-niveau, ikke per-aftale)
  const buying = internIndkoeb ? -0.04 : 0.04

  // Samlet besparelsesrate — min 4%, max 22%
  const rf = Math.min(0.22, Math.max(0.04, rate + cw + buying))

  const high = Math.round(total * rf)
  const low = Math.round(total * Math.max(0.03, rf - 0.025))
  const mid = Math.round((low + high) / 2)
  const honorar = Math.round(mid * 0.20)
  const netto = mid - honorar

  return {
    minBesparelse: low,
    maxBesparelse: high,
    medianBesparelse: mid,
    besparelsesProcentSpaend: `${Math.round(Math.max(0.03, rf - 0.025) * 100)}-${Math.round(rf * 100)}%`,
    honorar,
    netto,
    urgency: urgencyForRf(rf),
  }
}

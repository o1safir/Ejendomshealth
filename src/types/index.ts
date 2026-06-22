// Centrale typer for datamodellen.
// Holdes i sync med sql/001_initial_schema.sql

export interface Ejendom {
  id: string
  navn: string
  adresse: string | null
  postnr: string | null
  kommune: string | null
  bbr_nr: string | null
  matrikel_nr: string | null
  ejertype: 'udlejning' | 'ejer' | 'investering' | null
  areal_m2: number | null
  opfoerelsesaar: number | null
  antal_enheder: number | null
  anvendelse: string | null
  noter: string | null
  created_at: string
  updated_at: string
}

export type EjendomInput = Omit<Ejendom, 'id' | 'created_at' | 'updated_at'>

export interface Brand {
  id: string
  navn: string
  cvr: string | null
  adresse: string | null
  primaer_farve: string | null
  sekundaer_farve: string | null
  logo_url: string | null
  kontaktperson: string | null
  kontakt_titel: string | null
  kontakt_email: string | null
  kontakt_telefon: string | null
  website: string | null
  created_at: string
}

export interface Aftale {
  id: string
  ejendom_id: string
  kategori: string
  leverandoer: string | null
  nuvaerende_pris: number | null
  sidst_genforhandlet: string | null // ISO date
  opsigelsesfrist: string | null
  intern_indkoeb_findes: boolean
  besparelsesestimat_pct: number | null
  noter: string | null
  created_at: string
  updated_at: string
}

export type AftaleInput = Omit<Aftale, 'id' | 'created_at' | 'updated_at'>

export const AFTALE_KATEGORIER = [
  'Forsikringer',
  'Energi & forsyning',
  'Serviceaftaler',
  'Rengøring',
  'IT & telefoni',
  'Vagt & sikkerhed',
  'Vedligehold',
  'Andet',
] as const

export interface BesparelsesResultat {
  minBesparelse: number
  maxBesparelse: number
  medianBesparelse: number
  besparelsesProcentSpaend: string
  honorar: number
  netto: number
  urgency: 'ingen' | 'lav' | 'middel' | 'høj'
}

export type RapportType = 'dd' | 'esg' | 'besparelse' | 'health_check'

export interface Rapport {
  id: string
  ejendom_id: string
  brand_id: string | null
  rapport_type: RapportType
  pdf_storage_path: string | null
  genereret_data: Record<string, unknown> | null
  created_at: string
}

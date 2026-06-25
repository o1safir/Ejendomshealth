import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY skal være sat i .env / Vercel env vars."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Typer der matcher supabase/migrations/001-004
export type Boligtype =
  | "lejlighed"
  | "raekkehus"
  | "villa"
  | "udlejningsejendom"
  | "andet";

export type RapportType = "privat" | "investor";

export interface Ejendom {
  id: string;
  bfe_nummer: string | null;
  adresse: string;
  postnummer: string;
  by: string;
  boligtype: Boligtype;
  rapport_type: RapportType;
  er_andelsbolig: boolean;
  antal_enheder_paa_adresse: number;
  oprettet_at: string;
}

export interface Rapport {
  id: string;
  ejendom_id: string;
  rapport_type: RapportType;
  status: "afventer" | "genereres" | "klar" | "fejlet";
  pdf_storage_path: string | null;
  bestilt_af: string | null;
  oprettet_at: string;
  faerdig_at: string | null;
}

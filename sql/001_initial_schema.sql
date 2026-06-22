-- ============================================================
-- Ejendomshealth: Database-skema
-- Køres i Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ------------------------------------------------------------
-- 1. EJENDOMME (kerne-entitet)
-- ------------------------------------------------------------
create table if not exists ejendomme (
  id uuid primary key default gen_random_uuid(),
  navn text not null,
  adresse text,
  postnr text,
  kommune text,
  bbr_nr text,
  matrikel_nr text,
  ejertype text check (ejertype in ('udlejning', 'ejer', 'investering')),
  areal_m2 numeric,
  opfoerelsesaar int,
  antal_enheder int,
  anvendelse text,
  noter text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table ejendomme is 'Kerne-tabel: én række pr. ejendom/sag. Alle moduler refererer hertil.';

-- ------------------------------------------------------------
-- 2. BRAND-KONFIGURATION (Safir Consulting / Core Partners)
-- ------------------------------------------------------------
create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  navn text not null,                 -- f.eks. "Safir Consulting" eller "Core Partners"
  cvr text,
  adresse text,
  primaer_farve text,                 -- hex, f.eks. '#1B3A2F'
  sekundaer_farve text,
  logo_url text,                      -- peger på Supabase Storage
  kontaktperson text,
  kontakt_titel text,
  kontakt_email text,
  kontakt_telefon text,
  website text,
  created_at timestamptz not null default now()
);

comment on table brands is 'Branding-profiler. Vælges pr. rapport, så samme data kan udsendes under to selskaber.';

-- ------------------------------------------------------------
-- 3. AFTALER / LEVERANDØRER (Fase 1 modul)
-- ------------------------------------------------------------
create table if not exists aftaler (
  id uuid primary key default gen_random_uuid(),
  ejendom_id uuid not null references ejendomme(id) on delete cascade,
  kategori text not null,             -- 'forsikring', 'energi', 'service', 'rengoering', osv.
  leverandoer text,
  nuvaerende_pris numeric,
  sidst_genforhandlet date,
  opsigelsesfrist date,
  intern_indkoeb_findes boolean default false,
  besparelsesestimat_pct numeric,     -- udfyldes evt. manuelt eller af beregningen
  noter text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table aftaler is 'Fase 1: grundlag for besparelsespotentiale-rapporten (Core Partners-logik).';

-- ------------------------------------------------------------
-- 4. FINANSIELLE DATA (Fase 2 modul - forberedt nu, fyldes senere)
-- ------------------------------------------------------------
create table if not exists finansielle_data (
  id uuid primary key default gen_random_uuid(),
  ejendom_id uuid not null references ejendomme(id) on delete cascade,
  aar int not null,
  lejeindtaegter numeric,
  driftsudgifter numeric,
  noi numeric,                         -- Net Operating Income
  afkastkrav_pct numeric,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. ENERGI / KLIMA (Fase 3 modul - forberedt nu, fyldes senere)
-- ------------------------------------------------------------
create table if not exists energi_klima (
  id uuid primary key default gen_random_uuid(),
  ejendom_id uuid not null references ejendomme(id) on delete cascade,
  energimaerke text,                   -- 'A', 'B', 'C' osv.
  energimaerke_udloeber date,
  forbrug_kwh_m2 numeric,
  taksonomi_status text check (taksonomi_status in ('ja', 'nej', 'usikker')),
  noter text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. LEJEKONTRAKTER (Fase 2 modul - forberedt nu, fyldes senere)
-- ------------------------------------------------------------
create table if not exists lejekontrakter (
  id uuid primary key default gen_random_uuid(),
  ejendom_id uuid not null references ejendomme(id) on delete cascade,
  lejer text,
  areal_m2 numeric,
  leje_aarlig numeric,
  opsigelsesvarsel_maaneder int,
  indeksering text,
  udloebsdato date,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. BYGNINGSTILSTAND (Fase 2/4 modul - forberedt nu, fyldes senere)
-- ------------------------------------------------------------
create table if not exists bygningstilstand (
  id uuid primary key default gen_random_uuid(),
  ejendom_id uuid not null references ejendomme(id) on delete cascade,
  beskrivelse text,
  estimeret_pris numeric,
  seneste_syn_dato date,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 8. GENEREREDE RAPPORTER (log + Storage-reference)
-- ------------------------------------------------------------
create table if not exists rapporter (
  id uuid primary key default gen_random_uuid(),
  ejendom_id uuid not null references ejendomme(id) on delete cascade,
  brand_id uuid references brands(id),
  rapport_type text not null check (
    rapport_type in ('dd', 'esg', 'besparelse', 'health_check')
  ),
  pdf_storage_path text,               -- sti i Supabase Storage
  genereret_data jsonb,                -- snapshot af de data rapporten blev bygget på
  created_at timestamptz not null default now()
);

comment on table rapporter is 'Log over genererede rapporter + reference til PDF i Storage. genereret_data er et snapshot, så historiske rapporter ikke ændrer sig hvis kildedata opdateres senere.';

-- ------------------------------------------------------------
-- 9. BEREGNINGSKONSTANTER (delt "kilde til sandhed" for JS + Python)
-- ------------------------------------------------------------
create table if not exists beregningskonstanter (
  id text primary key,                 -- f.eks. 'besparelse_v1'
  konfiguration jsonb not null,
  opdateret_at timestamptz not null default now()
);

comment on table beregningskonstanter is 'Centrale tal for beregningerne (procentsatser, honorar-andel osv.), så JS-frontend og Python-rapportservice altid bruger samme værdier.';

-- Indsæt de aktuelle Core Partners-konstanter (fra det eksisterende besparelsesværktøj)
insert into beregningskonstanter (id, konfiguration) values (
  'besparelse_v1',
  '{
    "grundprocent_efter_alder": {
      "under_1_aar": 0.04,
      "1_til_2_aar": 0.08,
      "2_til_4_aar": 0.12,
      "over_4_aar": 0.16
    },
    "tillaeg_intet_internt_indkoeb": 0.04,
    "energi_kategori_maks_bidrag": 0.02,
    "loft_over_4_aar": 0.20,
    "honorar_andel_af_median": 0.15,
    "interval_spaend": { "min_offset": -0.03, "max_offset": 0.04 },
    "gulv_min_besparelse": 50000,
    "gulv_max_besparelse": 100000,
    "urgency_taerskler": { "lav": 0.10, "middel": 0.15 }
  }'::jsonb
)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 10. updated_at trigger (holder ejendomme.updated_at ajour)
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ejendomme_updated_at on ejendomme;
create trigger trg_ejendomme_updated_at
  before update on ejendomme
  for each row execute function set_updated_at();

drop trigger if exists trg_aftaler_updated_at on aftaler;
create trigger trg_aftaler_updated_at
  before update on aftaler
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 11. ROW LEVEL SECURITY
-- Da dette er et internt værktøj (kun dig som bruger via Supabase Auth),
-- låses adgang til at kræve en autentificeret bruger.
-- ------------------------------------------------------------
alter table ejendomme enable row level security;
alter table brands enable row level security;
alter table aftaler enable row level security;
alter table finansielle_data enable row level security;
alter table energi_klima enable row level security;
alter table lejekontrakter enable row level security;
alter table bygningstilstand enable row level security;
alter table rapporter enable row level security;
alter table beregningskonstanter enable row level security;

-- Politik: enhver autentificeret bruger (dig) har fuld adgang.
-- Udvides senere med "ejet af bruger"-logik hvis flere skal bruge systemet.
create policy "Autentificerede brugere har fuld adgang" on ejendomme
  for all using (auth.role() = 'authenticated');
create policy "Autentificerede brugere har fuld adgang" on brands
  for all using (auth.role() = 'authenticated');
create policy "Autentificerede brugere har fuld adgang" on aftaler
  for all using (auth.role() = 'authenticated');
create policy "Autentificerede brugere har fuld adgang" on finansielle_data
  for all using (auth.role() = 'authenticated');
create policy "Autentificerede brugere har fuld adgang" on energi_klima
  for all using (auth.role() = 'authenticated');
create policy "Autentificerede brugere har fuld adgang" on lejekontrakter
  for all using (auth.role() = 'authenticated');
create policy "Autentificerede brugere har fuld adgang" on bygningstilstand
  for all using (auth.role() = 'authenticated');
create policy "Autentificerede brugere har fuld adgang" on rapporter
  for all using (auth.role() = 'authenticated');
create policy "Autentificerede brugere kan læse konstanter" on beregningskonstanter
  for select using (auth.role() = 'authenticated');

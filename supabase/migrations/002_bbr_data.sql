-- ============================================================
-- 002_bbr_data.sql
-- Rå BBR-felter fra Datafordeleren/OIS, opdateres ved BBR-ændring
-- ============================================================

create table bbr_data (
  id uuid primary key default gen_random_uuid(),
  ejendom_id uuid not null references ejendomme(id) on delete cascade,

  -- Bygning
  opfoerelsesaar int,
  ombygningsaar int,
  ydervaeggsmateriale_kode text,
  tagdaekningsmateriale_kode text,
  varmeinstallation_kode text,        -- fjernvarme/naturgas/elvarme/varmepumpe/andet
  supplerende_varme_kode text,

  -- Areal
  bebygget_areal numeric,
  boligareal numeric,
  erhvervsareal numeric,
  kaelderareal numeric,
  antal_etager int,
  har_kaelder boolean default false,

  -- Enhed (relevant for lejlighed/andelsbolig)
  enhedens_anvendelse_kode text,
  antal_rum int,
  antal_vaerelser int,

  -- Tekniske anlæg
  har_solceller boolean default false,
  har_ventilation boolean default false,

  -- Datakvalitet
  bbr_sidst_opdateret date,
  rå_respons jsonb,                    -- fuld rå BBR-respons til debugging/fremtidige felter

  hentet_at timestamptz default now()
);

create index idx_bbr_ejendom on bbr_data(ejendom_id);

comment on table bbr_data is 'Rå BBR-felter. raa_respons gemmer hele svaret fra Datafordeleren så vi ikke skal genhente ved nye feltbehov.';

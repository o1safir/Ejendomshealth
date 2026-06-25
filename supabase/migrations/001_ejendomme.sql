-- ============================================================
-- 001_ejendomme.sql
-- Kernetabel: identificerer en ejendom uafhængigt af boligtype
-- ============================================================

create table ejendomme (
  id uuid primary key default gen_random_uuid(),
  bfe_nummer text unique,              -- Bestemt Fast Ejendom, nøgle på Datafordeleren
  adresse text not null,
  postnummer text not null,
  by text not null,
  kommune_kode text,

  -- Klassificering, bruges til at vælge rapporttype og analyselogik
  boligtype text not null check (boligtype in (
    'lejlighed', 'raekkehus', 'villa', 'udlejningsejendom', 'andet'
  )),
  rapport_type text not null check (rapport_type in ('privat', 'investor')),

  -- Ejerforhold (relevant for andelsbolig/ejerlejlighed vs. enkeltejer)
  er_andelsbolig boolean default false,
  antal_enheder_paa_adresse int default 1,

  oprettet_at timestamptz default now(),
  opdateret_at timestamptz default now()
);

create index idx_ejendomme_bfe on ejendomme(bfe_nummer);
create index idx_ejendomme_adresse on ejendomme(adresse, postnummer);

comment on table ejendomme is 'Kerneidentifikation af en ejendom. Al øvrig data (BBR, energi, analyse) kobles via ejendom_id.';

-- ============================================================
-- 004_analyse_output.sql
-- Jeres fortolkningslag, det der differentierer produktet fra rådata
-- ============================================================

create table analyse_output (
  id uuid primary key default gen_random_uuid(),
  ejendom_id uuid not null references ejendomme(id) on delete cascade,

  -- Overordnet vurdering, vises som "executive summary" i rapporten
  samlet_score int check (samlet_score between 1 and 100),
  score_forklaring text,

  -- Sammenligning med boligtype/årgang-gennemsnit (kræver egen benchmark-tabel, fase 2)
  energimaerke_vs_gennemsnit text,     -- 'bedre', 'paa_niveau', 'under_niveau'

  -- BBR-afvigelser og juridiske flags (jeres ekspertiseområde)
  bbr_afvigelser jsonb,                -- f.eks. uregistreret tilbygning
  juridiske_noter jsonb,               -- lokalplan, tinglysning, huslejenævn-relevans

  -- Boligtype-specifik gren
  -- 'lejlighed': fokus på fælles klimaskærm, ejerforening-beslutninger
  -- 'villa'/'raekkehus': fuld klimaskærm + varmeinstallation, inkl. gulvvarme-vurdering
  -- 'udlejningsejendom': ROI ift. forbedringsforhøjelse, huslejenævn
  boligtype_anbefaling jsonb,

  genereret_at timestamptz default now()
);

create index idx_analyse_ejendom on analyse_output(ejendom_id);

-- Selve rapport-leverancen (PDF), spejler Ejendomshealths mønster med Render-service
create table rapporter (
  id uuid primary key default gen_random_uuid(),
  ejendom_id uuid not null references ejendomme(id) on delete cascade,
  analyse_output_id uuid references analyse_output(id),

  rapport_type text not null check (rapport_type in ('privat', 'investor')),
  status text not null default 'afventer' check (status in (
    'afventer', 'genereres', 'klar', 'fejlet'
  )),

  pdf_storage_path text,               -- Supabase storage path
  bestilt_af text,                     -- email/bruger-id

  oprettet_at timestamptz default now(),
  faerdig_at timestamptz
);

create index idx_rapporter_ejendom on rapporter(ejendom_id);
create index idx_rapporter_status on rapporter(status);

comment on table analyse_output is 'Selve værditilvæksten: fortolkning af BBR + energidata til konkrete anbefalinger. Genberegnes når underliggende data ændres.';
comment on table rapporter is 'Spejler mønster fra ejendomshealth-rapport.onrender.com: status-flow afventer -> genereres -> klar/fejlet.';

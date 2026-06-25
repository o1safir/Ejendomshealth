-- ============================================================
-- 003_energimaerke.sql
-- Data fra EMOData-servicen
-- ============================================================

create table energimaerke (
  id uuid primary key default gen_random_uuid(),
  ejendom_id uuid not null references ejendomme(id) on delete cascade,

  maerke text check (maerke in ('A2020','A2015','A2010','B','C','D','E','F','G')),
  energiforbrug_kwh_m2_aar numeric,
  forventet_varmeudgift_aar numeric,
  co2_udledning_kg_aar numeric,

  udstedelsesdato date,
  gyldig_til date,
  energikonsulent_firma text,
  rapport_url text,                    -- link til PDF hos boligejer.dk hvis tilgængelig

  rå_respons jsonb,
  hentet_at timestamptz default now()
);

create index idx_energimaerke_ejendom on energimaerke(ejendom_id);

-- Forbedringsforslag fra EMO-rapporten, et-til-mange pr. ejendom
create table energiforslag (
  id uuid primary key default gen_random_uuid(),
  energimaerke_id uuid not null references energimaerke(id) on delete cascade,

  beskrivelse text not null,
  kategori text check (kategori in (
    'isolering_tag', 'isolering_facade', 'isolering_gulv',
    'vinduer', 'varmeanlaeg', 'ventilation', 'solceller', 'andet'
  )),
  investering_kr numeric,
  besparelse_kr_aar numeric,
  tilbagebetalingstid_aar numeric,     -- beregnes i analysemotoren (Python), ikke i databasen

  -- Sættes af jeres egen analysemotor, ikke fra EMO
  prioritet int,                       -- 1 = anbefales først
  match_tilskudsordning text           -- f.eks. 'bygningspuljen', sættes manuelt/separat job
);

create index idx_energiforslag_maerke on energiforslag(energimaerke_id);

comment on table energiforslag is 'Strukturerede forbedringsforslag fra EMO-rapporten. prioritet, tilbagebetalingstid_aar og match_tilskudsordning er jeres eget fortolkningslag, beregnet i analysemotoren, ikke fra EMO direkte.';

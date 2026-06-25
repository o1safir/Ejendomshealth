-- ============================================================
-- 005_dawa_adresse_id.sql
-- Tilføjer adgangsadresse-id fra DAWA, bruges som nøgle til
-- senere BFE/BBR-opslag via Datafordeleren.
-- ============================================================

alter table ejendomme
  add column dawa_adgangsadresse_id text;

create index idx_ejendomme_dawa on ejendomme(dawa_adgangsadresse_id);

comment on column ejendomme.dawa_adgangsadresse_id is
  'Adgangsadresse-id fra DAWA (api.dataforsyningen.dk). Bruges til at slå BFE-nummer og BBR-data op via Datafordeleren.';

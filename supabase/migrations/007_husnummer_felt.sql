-- ============================================================
-- 007_husnummer_felt.sql
-- Tilføjer husnummer som separat felt. Tidligere blev hus/etage/dør
-- sammensat i adresse-feltet (fx "Gersonsvej 37, 2. tv"), hvilket gjorde
-- det umuligt at splitte korrekt til EMOData's addressline-format
-- ("vejnavn husnr, postnr by") for lejligheder med etage/dør.
-- ============================================================

alter table ejendomme add column if not exists vejnavn text;
alter table ejendomme add column if not exists husnummer text;

comment on column ejendomme.vejnavn is
  'Vejnavn isoleret fra DAWA, bruges sammen med husnummer til EMOData-opslag (addressline-format kraever "vejnavn husnr, postnr by").';
comment on column ejendomme.husnummer is
  'Husnummer isoleret fra DAWA (kan inkl. bogstav, fx "100A"), IKKE etage/doer.';

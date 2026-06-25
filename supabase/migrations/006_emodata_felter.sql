-- ============================================================
-- 006_emodata_felter.sql
-- Justerer energimaerke/energiforslag til at matche det FAKTISKE
-- EMOData-svarformat, bekræftet ved test mod GetEnergyLabelImprovementSuggestions
-- (Gersonsvej 37, 2900 Hellerup, 25. juni 2026).
--
-- Køres EFTER 003_energimaerke.sql er kørt i jeres database.
-- ============================================================

-- maerke-feltet i 003 begrænsede til ('A2020','A2015',...), men det
-- faktiske CurrentEnergyLabel-felt kan returnere andre værdier
-- (set i test: "C", "E"), drop derfor det gamle check og udvid.
alter table energimaerke drop constraint if exists energimaerke_maerke_check;
alter table energimaerke add constraint energimaerke_maerke_check
  check (maerke in ('A2020','A2015','A2010','B','C','D','E','F','G','A','A1','A2'));

-- Nye felter der matcher EMOData direkte
alter table energimaerke add column if not exists energy_label_number bigint;
alter table energimaerke add column if not exists bbr_number text;
alter table energimaerke add column if not exists bfe_number text;
alter table energimaerke add column if not exists label_status text
  check (label_status in ('VALID', 'EXPIRED', 'UNKNOWN'));
alter table energimaerke add column if not exists pdf_link text;

create index if not exists idx_energimaerke_bbr on energimaerke(bbr_number);
create index if not exists idx_energimaerke_label_number on energimaerke(energy_label_number);

comment on column energimaerke.label_status is
  'Direkte fra EMOData LabelStatus-felt (VALID/EXPIRED), IKKE beregnet lokalt. En adresse kan have flere mærker over tid, vælg det nyeste VALID.';

-- energiforslag: tilføj de felter EMOData faktisk giver, som vi
-- tidligere ikke havde (Profitable, Recommended, energi i kWh)
alter table energiforslag add column if not exists energi_sparet_kwh numeric;
alter table energiforslag add column if not exists levetid_aar int;
alter table energiforslag add column if not exists profitabel boolean;
alter table energiforslag add column if not exists anbefalet_af_emo boolean;
alter table energiforslag add column if not exists seeb_beskrivelse text;
alter table energiforslag add column if not exists proposal_group_id bigint;
alter table energiforslag add column if not exists headline text;

comment on column energiforslag.profitabel is
  'Direkte fra EMOData Profitable-felt. Bemærk: kan være true selv når Recommended er "Not", de to felter måler ikke samme ting.';
comment on column energiforslag.seeb_beskrivelse is
  'Dansk klartekst-kategori fra EMOData (SeebClassificationDescription), fx "Massive ydervægge", "Loft". kategori-feltet er vores egen mapping af denne.';

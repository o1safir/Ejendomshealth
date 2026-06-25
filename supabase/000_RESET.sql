-- ============================================================
-- 000_RESET.sql
-- KØR DETTE MANUELT I SUPABASE SQL-EDITOR.
-- Dette dropper ALLE eksisterende tabeller i public schema.
-- Bekræftet at der ikke er produktionsdata der skal bevares.
--
-- Kør denne fil FØR du kører 001-004 fra migrations-mappen.
-- ============================================================

-- Dropper alle tabeller i public schema, inkl. fremmednøgler (CASCADE)
do $$
declare
    r record;
begin
    for r in (select tablename from pg_tables where schemaname = 'public')
    loop
        execute 'drop table if exists public.' || quote_ident(r.tablename) || ' cascade';
    end loop;
end $$;

-- Dropper eventuelle custom types/enums fra det gamle projekt
do $$
declare
    r record;
begin
    for r in (select typname from pg_type
              join pg_namespace on pg_namespace.oid = pg_type.typnamespace
              where pg_namespace.nspname = 'public' and pg_type.typtype = 'e')
    loop
        execute 'drop type if exists public.' || quote_ident(r.typname) || ' cascade';
    end loop;
end $$;

-- Tjek: skal returnere 0 rækker hvis nulstilling lykkedes
select tablename from pg_tables where schemaname = 'public';

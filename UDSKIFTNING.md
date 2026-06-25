# Udskiftningstjekliste

Følg denne rækkefølge. Hvert trin er noget DU udfører i jeres konti,
jeg kan ikke logge ind på Vercel/Supabase/Render for jer.

## 1. Supabase (gør dette først, det er irreversibelt)

1. Log ind på supabase.com → projekt `efelesduhwgjvqziqzuy`
2. Gå til SQL Editor
3. Kør `supabase/000_RESET.sql` (dropper alle eksisterende tabeller)
4. Kør herefter migrationerne i rækkefølge:
   - `supabase/migrations/001_ejendomme.sql`
   - `supabase/migrations/002_bbr_data.sql`
   - `supabase/migrations/003_energimaerke.sql`
   - `supabase/migrations/004_analyse_output.sql`
5. Verificer under Table Editor at de 6 nye tabeller findes:
   `ejendomme`, `bbr_data`, `energimaerke`, `energiforslag`,
   `analyse_output`, `rapporter`
6. Kopier projektets `anon key` (Settings → API) til brug i trin 2

## 2. Frontend-kode (erstatter eksisterende repo-indhold)

1. I jeres eksisterende Git-repo for ejendomshealth: slet alt indhold
   undtagen `.git/`
2. Kopier hele indholdet af denne `ejendomshealth-v2`-mappe ind i repoet
3. Kør lokalt for at verificere før push:
   ```
   npm install
   cp .env.example .env
   # udfyld VITE_SUPABASE_ANON_KEY i .env
   npm run dev
   ```
4. Bekræft at "Opret ejendom" virker og skriver til Supabase
5. Commit og push til den branch Vercel allerede deployer fra
   (typisk `main`), Vercel bygger automatisk på push

## 3. Vercel environment variables

I samme Vercel-projekt (`ejendomshealth`), under Settings → Environment
Variables, opdater eller tilføj:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_REPORT_SERVICE_URL`

Redeploy efter at have sat variablerne (Vercel redeployer normalt
automatisk ved push, men env-ændringer kræver ofte manuel "Redeploy"
fra Deployments-fanen).

## 4. Render report-service

Det Python-baserede report-service (`server/`-mappen) skal også
opdateres. Da I allerede har en fungerende Render-opsætning med
WeasyPrint, er den hurtigste vej:

1. I det eksisterende Render-projekt, erstat indholdet af repoet
   (samme fremgangsmåde som trin 2) med `server/`-mappens indhold
   plus en ny `main.py` der eksponerer `/generer`-endpointet
   (ikke bygget endnu, se note nedenfor)
2. Tilføj environment variables i Render: `EMODATA_USERNAME`,
   `EMODATA_PASSWORD`, `DATAFORDELER_USERNAME`, `DATAFORDELER_PASSWORD`,
   `SUPABASE_SERVICE_ROLE_KEY` (til skriveadgang fra serveren)

**Note:** `server/main.py` med selve `/generer`-endpointet og
PDF-genereringen er ikke bygget i denne omgang. Frontend'en
(`EjendomDetalje.tsx`) forventer endpointet, men kalder det først når
I rent faktisk har BBR/EMOData-adgang, så det giver mening at bygge
det, når I har de første rigtige testdata at validere imod, i stedet
for at gætte på responsformatet nu.

## 5. Verificer hele kæden

1. Åbn `ejendomshealth.vercel.app`
2. Opret en testejendom
3. Bekræft rækken vises i Supabase Table Editor
4. (Når server/main.py er bygget) Klik "Generer rapport" og bekræft
   status går afventer → genereres → klar/fejlet

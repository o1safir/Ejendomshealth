# Ejendomshealth — internt rapporteringsværktøj

Internt værktøj til Safir Consulting / Core Partners. Holder ejendomsdata ét sted
og genererer brandede PDF-rapporter (starter med besparelsespotentiale-rapporten).

## Struktur

```
ejendomshealth/
├── src/                    React-app (frontend)
├── sql/                    Database-skema (køres i Supabase)
├── report_service/         Python-service der genererer PDF-rapporter
└── .env                    Supabase-forbindelse (IKKE i git)
```

## Opsætning — trin for trin

### 1. Database-skema (Supabase)

1. Gå til [supabase.com/dashboard](https://supabase.com/dashboard) → dit projekt
2. Venstre menu → **SQL Editor** → **New query**
3. Kopiér hele indholdet af `sql/001_initial_schema.sql` ind og tryk **Run**
4. Tjek under **Table Editor**, at tabellerne `ejendomme`, `aftaler`, `brands` osv. er oprettet

### 2. Opret din bruger (login til appen)

1. I Supabase-dashboardet: **Authentication** → **Users** → **Add user**
2. Indtast din egen email og en adgangskode — det er den, du logger ind med i appen
3. (Du behøver ikke "Send invite", bare opret brugeren direkte med en adgangskode)

### 3. Opret Storage-bucket til PDF'er

1. **Storage** → **New bucket**
2. Navn: `rapporter`
3. Sæt den til **Private** (ikke public) — rapporterne indeholder kundedata

### 4. Indsæt dine brands (Safir Consulting / Core Partners)

I **Table Editor** → `brands` → **Insert row**, opret to rækker, f.eks.:

| navn | cvr | primaer_farve | kontaktperson | kontakt_email |
|---|---|---|---|---|
| Core Partners | 43260243 | #1B3A2F | Mark Safir Nielsen | kontakt@corepartners.dk |
| Safir Consulting | 43260243 | #1B3A2F | Mark Safir Nielsen | kontakt@safirconsulting.dk |

(Juster farver/tekst efter dine faktiske brandfarver.)

### 5. Frontend — lokal test

```bash
cd ejendomshealth
npm install
npm run dev
```

Åbn linket der vises (typisk `http://localhost:5173`), log ind med den bruger du
oprettede i trin 2.

**Bemærk:** `.env` indeholder allerede dit Supabase URL og publishable key.
`VITE_RAPPORT_SERVICE_URL` skal tilføjes, når du har deployet rapport-servicen (trin 7).

### 6. Frontend — deploy til Vercel

1. Push koden til et GitHub-repo (privat repo, da der er forretningslogik i)
2. Gå til [vercel.com](https://vercel.com) → **New Project** → vælg dit repo
3. Under **Environment Variables**, tilføj:
   - `VITE_SUPABASE_URL` = `https://efelesduhwgjvqziqzuy.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = (din publishable key)
   - `VITE_RAPPORT_SERVICE_URL` = (sæt denne efter trin 7)
4. Deploy

### 7. Rapport-service — deploy til Render

Servicen kører separat, fordi PDF-generering (WeasyPrint) kræver systembiblioteker
som ikke fungerer i en almindelig frontend-hosting.

1. Gå til [render.com](https://render.com) → **New** → **Web Service**
2. Forbind samme GitHub-repo, men sæt **Root Directory** til `report_service`
3. **Build Command**: `pip install -r requirements.txt`
4. **Start Command**: `gunicorn app:app`
5. Under **Environment Variables**, tilføj:
   - `SUPABASE_URL` = `https://efelesduhwgjvqziqzuy.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = **din service_role-nøgle** (findes i Supabase →
     Project Settings → API → "service_role" — IKKE samme som publishable key!
     Denne nøgle har fuld adgang og må ALDRIG lægges i frontend-kode eller git)
6. Deploy. Render giver dig en URL som `https://ejendomshealth-rapport.onrender.com`
7. Gå tilbage til Vercel og sæt `VITE_RAPPORT_SERVICE_URL` til denne URL, redeploy

**Bemærk om gratis Render-plan:** Tjenesten "sover" efter inaktivitet og kan tage
op til 30-60 sekunder at vække ved første kald. Det er fint til internt brug, men
overvej en betalt plan ($7/md) hvis du skal generere rapporter live foran en kunde.

## Synkroniseringspunkt: beregningskonstanter

Tabellen `beregningskonstanter` i databasen er "kilden til sandhed" for alle
procentsatser i besparelsesberegningen. Hvis du vil ændre dem (f.eks. honorar-andel
eller grundprocenter), redigér rækken direkte i Supabase Table Editor — både
frontend (live overslag) og rapport-service (PDF) læser fra samme sted.

Hvis du derimod ændrer selve **beregningsmetoden** (ikke kun tallene), skal du
opdatere begge:
- `src/lib/besparelseBeregning.ts` (frontend, live overslag)
- `report_service/besparelse_beregning.py` (autoritativ, bruges i PDF)

## Næste faser (ikke bygget endnu)

- Fase 2: Finansielt + Lejekontrakter-moduler → DD-rapport
- Fase 3: Energi/klima-modul → ESG-statusrapport
- Fase 4: Samlet "health-check" rapport med scoring

Databasetabellerne til disse findes allerede i skemaet (`finansielle_data`,
`energi_klima`, `lejekontrakter`, `bygningstilstand`), så de er klar til at blive
koblet til UI og rapport-templates, når du er klar til at bygge dem.

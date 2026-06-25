"""
main.py

Render-service der eksponerer /generer-endpointet, kaldt fra frontend'en
(EjendomDetalje.tsx) når brugeren klikker "Generer rapport".

NUVÆRENDE SCOPE (bevidst afgrænset):
- EMOData-opslag: BEKRÆFTET virker (testet mod Gersonsvej 37, 25. juni 2026)
- BBR-opslag via Datafordeleren: IKKE bekræftet endnu, adgang er uklar.
  Indtil det er på plads, køres analysen UDEN BBR-felter (opførelsesår,
  ydervægsmateriale osv. sættes til None), analysemotoren håndterer det
  allerede uden at fejle. Rapporten bliver fuldt brugbar på EMOData alene,
  BBR-berigelse kan eftermonteres uden at ændre denne grundstruktur.
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

from emodata_client import EMODataClient, EMODataError
from analyse_engine import AnalyseInput, Boligtype, koer_analyse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ejendomshealth")

supabase: Client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global supabase
    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],  # service_role, ikke anon, server skriver på tværs af RLS
    )
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # internt værktøj, stram til jeres faktiske Vercel-domæne ved behov
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class GenererRequest(BaseModel):
    ejendom_id: str
    rapport_id: str


@app.post("/generer")
async def generer_rapport(req: GenererRequest):
    try:
        ejendom = (
            supabase.table("ejendomme").select("*").eq("id", req.ejendom_id).single().execute()
        ).data

        if not ejendom:
            raise HTTPException(404, "Ejendom ikke fundet")

        # --- EMOData-opslag (bekræftet virker) ---
        # Bruger separate vejnavn/husnummer-felter (migration 007), undgår
        # at splitte en sammensat adressestreng der kan indeholde etage/dør
        # (fx "Gersonsvej 37, 2. tv" ville splitte forkert på sidste mellemrum)
        vejnavn = ejendom.get("vejnavn")
        husnummer = ejendom.get("husnummer")
        if not vejnavn or not husnummer:
            raise HTTPException(
                422,
                "Ejendommen mangler vejnavn/husnummer (oprettet før adresse-autocomplete "
                "blev indført). Opret ejendommen igen via adressefeltet for at få struktureret data.",
            )

        emo_client = EMODataClient()
        try:
            maerker = emo_client.hent_forbedringsforslag(
                vejnavn=vejnavn,
                husnr=husnummer,
                postnr=ejendom["postnummer"],
                by=ejendom["by"],
            )
        except EMODataError as e:
            logger.warning(f"EMOData fejl for ejendom {req.ejendom_id}: {e}")
            maerker = []

        nyeste_maerke = emo_client.nyeste_gyldige(maerker) if maerker else None

        # --- Gem energimaerke + energiforslag i Supabase ---
        energimaerke_id = None
        energiforslag_dicts: list[dict] = []

        if nyeste_maerke:
            em_row = (
                supabase.table("energimaerke")
                .insert(
                    {
                        "ejendom_id": req.ejendom_id,
                        "maerke": nyeste_maerke.klassifikation,
                        "energy_label_number": nyeste_maerke.energy_label_number,
                        "bbr_number": nyeste_maerke.bbr_number,
                        "bfe_number": nyeste_maerke.bfe_number,
                        "label_status": nyeste_maerke.label_status,
                        "rapport_url": nyeste_maerke.demo_link,
                        "pdf_link": nyeste_maerke.pdf_link,
                        "raa_respons": nyeste_maerke.raa_respons,
                    }
                )
                .execute()
            ).data[0]
            energimaerke_id = em_row["id"]

            for forslag in nyeste_maerke.forslag:
                forslag_row = (
                    supabase.table("energiforslag")
                    .insert(
                        {
                            "energimaerke_id": energimaerke_id,
                            "headline": forslag.headline,
                            "beskrivelse": forslag.beskrivelse,
                            "kategori": forslag.kategori,
                            "investering_kr": forslag.investering_kr,
                            "besparelse_kr_aar": forslag.besparelse_kr_aar,
                            "energi_sparet_kwh": forslag.energi_sparet_kwh,
                            "levetid_aar": forslag.levetid_aar,
                            "profitabel": forslag.profitabel,
                            "anbefalet_af_emo": forslag.anbefalet,
                            "seeb_beskrivelse": forslag.seeb_beskrivelse,
                            "proposal_group_id": forslag.proposal_group_id,
                        }
                    )
                    .execute()
                ).data[0]
                energiforslag_dicts.append(
                    {
                        "id": forslag_row["id"],
                        "headline": forslag.headline,
                        "kategori": forslag.kategori,
                        "investering_kr": forslag.investering_kr,
                        "besparelse_kr_aar": forslag.besparelse_kr_aar,
                        "profitabel": forslag.profitabel,
                    }
                )

        # --- BBR-data: IKKE tilgængelig endnu, sæt None, analysemotoren håndterer det ---
        bbr_opfoerelsesaar = None
        bbr_ombygningsaar = None

        # --- Kør analysemotoren ---
        analyse_input = AnalyseInput(
            boligtype=Boligtype(ejendom["boligtype"]),
            opfoerelsesaar=bbr_opfoerelsesaar,
            ombygningsaar=bbr_ombygningsaar,
            boligareal=None,
            varmeinstallation_kode=None,
            energimaerke=nyeste_maerke.klassifikation if nyeste_maerke else None,
            energiforslag=energiforslag_dicts,
            antal_enheder_paa_adresse=ejendom.get("antal_enheder_paa_adresse", 1),
            bbr_afvigelser=[],
        )
        resultat = koer_analyse(analyse_input)

        # Skriv prioritet tilbage til energiforslag-rækkerne
        for f in resultat.prioriterede_forslag:
            supabase.table("energiforslag").update({"prioritet": f["prioritet"]}).eq(
                "id", f["id"]
            ).execute()

        # --- Gem analyse_output ---
        analyse_row = (
            supabase.table("analyse_output")
            .insert(
                {
                    "ejendom_id": req.ejendom_id,
                    "samlet_score": resultat.samlet_score,
                    "score_forklaring": resultat.score_forklaring
                    + (
                        " Bemærk: BBR-data (opførelsesår, byggematerialer) er endnu ikke "
                        "tilkoblet, scoren er udelukkende baseret på energimærke."
                        if bbr_opfoerelsesaar is None
                        else ""
                    ),
                    "boligtype_anbefaling": resultat.boligtype_anbefaling,
                    "juridiske_noter": resultat.juridiske_noter,
                }
            )
            .execute()
        ).data[0]

        # --- Marker rapport som klar ---
        supabase.table("rapporter").update(
            {
                "status": "klar",
                "analyse_output_id": analyse_row["id"],
                "faerdig_at": "now()",
            }
        ).eq("id", req.rapport_id).execute()

        return {
            "status": "ok",
            "analyse_output_id": analyse_row["id"],
            "energimaerke_fundet": nyeste_maerke is not None,
            "antal_forslag": len(energiforslag_dicts),
        }

    except Exception as e:
        logger.exception(f"Fejl ved generering af rapport {req.rapport_id}")
        supabase.table("rapporter").update({"status": "fejlet"}).eq(
            "id", req.rapport_id
        ).execute()
        raise HTTPException(500, str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}

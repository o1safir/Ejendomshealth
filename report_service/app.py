"""
Rapport-service: genererer brandede PDF-rapporter fra data i Supabase.

Kører som en separat lille service (Render/Railway), fordi WeasyPrint
kræver systembiblioteker som ikke fungerer i en ren frontend-deployment.

Miljøvariabler (sæt på hosting-platformen, ALDRIG i kode):
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY   <- den hemmelige nøgle, kun her, aldrig i frontend
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from io import BytesIO

import requests as http
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from jinja2 import Environment, FileSystemLoader
from supabase import create_client
from weasyprint import HTML

from besparelse_beregning import beregn_besparelse

app = Flask(__name__)
CORS(app)  # Tillader kald fra din React-app's domæne

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY skal sættes som miljøvariabler "
        "på hosting-platformen (Render/Railway), ikke i koden."
    )

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

jinja_env = Environment(loader=FileSystemLoader("templates"))

URGENCY_LABELS = {
    "ingen": "Intet nævneværdigt potentiale",
    "lav": "Muligt besparelsespotentiale",
    "middel": "Klart besparelsespotentiale",
    "høj": "Betydeligt besparelsespotentiale",
}

URGENCY_FARVER = {
    "ingen": "#6b7570",
    "lav": "#4a7a63",
    "middel": "#c4821a",
    "høj": "#b3372c",
}

ANALYSE_TEKST = {
    "ingen": "Med de nuværende faste omkostninger er det estimerede besparelsespotentiale "
             "for lille til at gøre et samarbejde meningsfuldt på nuværende tidspunkt.",
    "lav": "På baggrund af de registrerede aftaler ses et muligt besparelsespotentiale. "
           "En nærmere gennemgang vil kunne afdække, om der er noget konkret at hente.",
    "middel": "På baggrund af de registrerede aftaler og deres alder ses et klart "
              "besparelsespotentiale, som bør undersøges nærmere.",
    "høj": "På baggrund af de registrerede aftaler ses et betydeligt besparelsespotentiale. "
           "Vi anbefaler en prioriteret gennemgang af de identificerede kategorier.",
}


def _kr(value: float) -> str:
    return f"{value:,.0f}".replace(",", ".")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/bbr-opslag", methods=["GET"])
def bbr_opslag():
    """
    Slår en adresse op i BBR. Prøver to strategier:
    1. bygning via adgangsadresse-ID  → samlede bygningsdata
    2. enhed via specifik adresse-ID  → boligareal for ejerlejligheder
    Returnerer tomt objekt stille hvis credentials mangler.
    """
    adgangsadresse_id = request.args.get("id", "").strip()
    adresse_id = request.args.get("adresse_id", "").strip()

    if not adgangsadresse_id and not adresse_id:
        return jsonify({"fejl": "id er påkrævet"}), 400

    bbr_user = os.environ.get("BBR_USERNAME")
    bbr_pass = os.environ.get("BBR_PASSWORD")
    if not bbr_user or not bbr_pass:
        return jsonify({}), 200

    auth = {"username": bbr_user, "password": bbr_pass, "format": "json"}

    # --- Strategi 1: bygning via adgangsadresse ---
    bygning_data = None
    if adgangsadresse_id:
        try:
            r = http.get(
                "https://services.datafordeler.dk/BBR/BBRPublic/1/rest/bygning",
                params={**auth, "husnummer": adgangsadresse_id},
                timeout=8,
            )
            if r.ok:
                bygninger = r.json()
                if bygninger:
                    b = max(bygninger, key=lambda x: x.get("byg_samletBygningsareal") or 0)
                    bolig = b.get("byg_antal_boligenheder") or 0
                    erhverv = b.get("byg_antal_erhvervsenheder") or 0
                    bygning_data = {
                        "areal_m2": b.get("byg_samletBygningsareal"),
                        "opfoerelsesaar": b.get("byg_opfoerelsesaar"),
                        "antal_enheder": (bolig + erhverv) or None,
                        "bbr_nr": str(b["BFEnummer"]) if b.get("BFEnummer") else None,
                        "matrikel_nr": b.get("matrikelnr"),
                    }
            else:
                app.logger.warning(f"BBR bygning svarede {r.status_code}")
        except Exception as e:
            app.logger.warning(f"BBR bygning-opslag fejlede: {e}")

    # --- Strategi 2: enhed via specifik adresse-ID (ejerlejlighed) ---
    enhed_data = None
    if adresse_id:
        try:
            r = http.get(
                "https://services.datafordeler.dk/BBR/BBRPublic/1/rest/enhed",
                params={**auth, "adresseIdentificerer": adresse_id},
                timeout=8,
            )
            if r.ok:
                enheder = r.json()
                app.logger.info(f"BBR enhed rå svar: {str(enheder)[:400]}")
                if enheder:
                    e = enheder[0]
                    areal = e.get("enh_boligAreal") or e.get("enh_samletAreal")

                    # Hvis vi ikke har bygningsdata endnu, prøv via enhedens eget husnummer-felt
                    if not bygning_data:
                        enhed_husnummer = e.get("husnummer")
                        if enhed_husnummer:
                            try:
                                r2 = http.get(
                                    "https://services.datafordeler.dk/BBR/BBRPublic/1/rest/bygning",
                                    params={**auth, "husnummer": enhed_husnummer},
                                    timeout=8,
                                )
                                if r2.ok:
                                    bygninger2 = r2.json()
                                    if bygninger2:
                                        b2 = max(bygninger2, key=lambda x: x.get("byg_samletBygningsareal") or 0)
                                        bolig2 = b2.get("byg_antal_boligenheder") or 0
                                        erhverv2 = b2.get("byg_antal_erhvervsenheder") or 0
                                        bygning_data = {
                                            "areal_m2": b2.get("byg_samletBygningsareal"),
                                            "opfoerelsesaar": b2.get("byg_opfoerelsesaar"),
                                            "antal_enheder": (bolig2 + erhverv2) or None,
                                            "bbr_nr": str(b2["BFEnummer"]) if b2.get("BFEnummer") else None,
                                            "matrikel_nr": b2.get("matrikelnr"),
                                        }
                                        app.logger.info(f"BBR bygning via enhed-husnummer: {bygning_data}")
                            except Exception as e2:
                                app.logger.warning(f"BBR bygning via enhed-husnummer fejlede: {e2}")

                    enhed_data = {
                        "areal_m2": areal,
                        "opfoerelsesaar": bygning_data.get("opfoerelsesaar") if bygning_data else None,
                        "antal_enheder": None,
                        "bbr_nr": bygning_data.get("bbr_nr") if bygning_data else None,
                        "matrikel_nr": bygning_data.get("matrikel_nr") if bygning_data else None,
                    }
            else:
                app.logger.warning(f"BBR enhed svarede {r.status_code}: {r.text[:200]}")
        except Exception as e:
            app.logger.warning(f"BBR enhed-opslag fejlede: {e}")

    # Brug enhed-areal hvis tilgængeligt (mere præcist for ejerlejligheder),
    # ellers fald tilbage til bygningsdata
    if enhed_data and enhed_data.get("areal_m2"):
        return jsonify(enhed_data)
    if bygning_data and (bygning_data.get("areal_m2") or bygning_data.get("opfoerelsesaar")):
        return jsonify(bygning_data)
    return jsonify({})


@app.route("/generer-rapport", methods=["POST"])
def generer_rapport():
    body = request.get_json(force=True)
    ejendom_id = body.get("ejendom_id")
    brand_navn_filter = body.get("brand_navn")  # valgfrit: hvilket brand skal bruges

    if not ejendom_id:
        return jsonify({"fejl": "ejendom_id er påkrævet"}), 400

    # --- Hent data fra Supabase ---
    ejendom_res = supabase.table("ejendomme").select("*").eq("id", ejendom_id).single().execute()
    ejendom = ejendom_res.data
    if not ejendom:
        return jsonify({"fejl": "Ejendom ikke fundet"}), 404

    aftaler_res = supabase.table("aftaler").select("*").eq("ejendom_id", ejendom_id).execute()
    aftaler = aftaler_res.data or []

    if not aftaler:
        return jsonify({"fejl": "Ingen aftaler registreret for denne ejendom"}), 400

    brand_query = supabase.table("brands").select("*")
    if brand_navn_filter:
        brand_query = brand_query.eq("navn", brand_navn_filter)
    brand_res = brand_query.limit(1).execute()
    brand = brand_res.data[0] if brand_res.data else {}

    # --- Beregn (autoritativ Python-version) ---
    resultat = beregn_besparelse(aftaler, intern_indkoeb=bool(ejendom.get("intern_indkoeb_findes")))
    if resultat is None:
        return jsonify({"fejl": "Kunne ikke beregne besparelse — tjek at aftaler har en pris"}), 400

    # --- Byg template-kontekst ---
    template = jinja_env.get_template("besparelsesrapport.html")
    html_ud = template.render(
        brand_navn=brand.get("navn", "Core Partners"),
        brand_adresse=brand.get("adresse", ""),
        brand_cvr=brand.get("cvr", ""),
        primaer_farve=brand.get("primaer_farve") or "#1B3A2F",
        ejendom_navn=ejendom["navn"],
        ejendom_adresse=ejendom.get("adresse") or "",
        urgency_label=URGENCY_LABELS[resultat["urgency"]],
        urgency_farve=URGENCY_FARVER[resultat["urgency"]],
        min_besparelse=_kr(resultat["min_besparelse"]),
        max_besparelse=_kr(resultat["max_besparelse"]),
        besparelses_procent_spaend=resultat["besparelses_procent_spaend"],
        honorar=_kr(resultat["honorar"]),
        netto=_kr(resultat["netto"]),
        analyse_tekst=ANALYSE_TEKST[resultat["urgency"]],
        aftaler=[
            {
                "kategori": a["kategori"],
                "leverandoer": a.get("leverandoer") or "–",
                "pris": _kr(a.get("nuvaerende_pris") or 0),
                "genforhandlet": a.get("sidst_genforhandlet") or "–",
            }
            for a in aftaler
        ],
        kontaktperson=brand.get("kontaktperson", ""),
        kontakt_titel=brand.get("kontakt_titel", ""),
        kontakt_email=brand.get("kontakt_email", ""),
        kontakt_telefon=brand.get("kontakt_telefon", ""),
        genereret_dato=datetime.now(timezone.utc).strftime("%d-%m-%Y"),
    )

    # --- Generér PDF ---
    pdf_bytes = HTML(string=html_ud).write_pdf()

    # --- Log rapporten + gem i Storage ---
    storage_path = f"{ejendom_id}/besparelse-{datetime.now(timezone.utc).timestamp():.0f}.pdf"
    try:
        supabase.storage.from_("rapporter").upload(
            storage_path, pdf_bytes, {"content-type": "application/pdf"}
        )
        supabase.table("rapporter").insert(
            {
                "ejendom_id": ejendom_id,
                "rapport_type": "besparelse",
                "pdf_storage_path": storage_path,
                "genereret_data": resultat,
            }
        ).execute()
    except Exception as e:
        # Rapporten kan stadig returneres til brugeren, selv hvis logning fejler
        app.logger.warning(f"Kunne ikke gemme rapport-log/storage: {e}")

    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"besparelsesrapport-{ejendom['navn']}.pdf",
    )


@app.route("/energimaerke-opslag", methods=["GET"])
def energimaerke_opslag():
    """
    Henter energimærke fra Energistyrelsens EMO-system.
    Kræver ingen credentials — data er offentligt tilgængeligt.
    """
    vejnavn = request.args.get("vejnavn", "").strip()
    husnr = request.args.get("husnr", "").strip()
    postnr = request.args.get("postnr", "").strip()

    if not vejnavn or not postnr:
        return jsonify({}), 200

    try:
        r = http.get(
            "https://emoweb.dk/EMOData/EMOData.svc/json/FindEjendom",
            params={"vejnavn": vejnavn, "husnr": husnr, "postnr": postnr, "bynavn": ""},
            timeout=8,
            headers={"Accept": "application/json"},
        )
        if not r.ok:
            app.logger.warning(f"Energimærke svarede {r.status_code}: {r.text[:200]}")
            return jsonify({}), 200

        app.logger.info(f"Energimærke rå svar: {r.text[:600]}")
        data = r.json()

        # Normaliser svaret — strukturen kan variere
        result = data.get("FindEjendomResult") or data
        if isinstance(result, dict):
            ejdomme = result.get("EjendomList", {})
            if isinstance(ejdomme, dict):
                ejdomme = ejdomme.get("Ejendom", [])
            if isinstance(ejdomme, dict):
                ejdomme = [ejdomme]
        elif isinstance(result, list):
            ejdomme = result
        else:
            ejdomme = []

        if not ejdomme:
            return jsonify({}), 200

        ej = ejdomme[0]
        maerker = ej.get("Energimaerker", {})
        if isinstance(maerker, dict):
            maerker = maerker.get("Energimaerke", [])
        if isinstance(maerker, dict):
            maerker = [maerker]

        if not maerker:
            return jsonify({}), 200

        # Seneste gyldige mærke øverst
        maerke = sorted(maerker, key=lambda x: x.get("GyldigFra") or "", reverse=True)[0]
        gyldigt_til = maerke.get("GyldigTil") or ""

        return jsonify({
            "label": maerke.get("EnergiLabel") or maerke.get("Energimaerke"),
            "gyldigt_til": gyldigt_til[:10] if gyldigt_til else None,
        })

    except Exception as e:
        app.logger.warning(f"Energimærke-opslag fejlede: {e}")
        return jsonify({}), 200


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    app.run(host="0.0.0.0", port=port)

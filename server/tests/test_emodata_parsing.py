"""
test_emodata_parsing.py

Validerer parsing-logikken i emodata_client.py mod et faktisk, gemt
API-svar (test_data_gersonsvej37.json), uden at kalde det rigtige
endpoint. Køres med: python -m tests.test_emodata_parsing
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from emodata_client import EMODataClient


def main():
    testdata_path = os.path.join(os.path.dirname(__file__), "test_data_gersonsvej37.json")
    with open(testdata_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    client = EMODataClient(username="dummy", password="dummy")
    result = raw_data["GetEnergyLabelImprovementSuggestionsResult"]

    maerker = [client._parse_maerke(m) for m in result["EnergyLabels"]]
    maerker.sort(key=lambda m: client._parse_dansk_dato(m.valid_from), reverse=True)

    print(f"Antal maerker fundet: {len(maerker)}")
    for m in maerker:
        print(f"  - {m.klassifikation} | {m.label_status} | {m.valid_from} -> {m.valid_to} | {len(m.forslag)} forslag (efter filter)")

    nyeste = client.nyeste_gyldige(maerker)
    assert nyeste is not None, "FEJL: intet gyldigt maerke fundet"
    assert nyeste.klassifikation == "C", f"FEJL: forventede klasse C, fik {nyeste.klassifikation}"
    assert nyeste.label_status == "VALID", "FEJL: nyeste_gyldige returnerede ikke et VALID maerke"
    print(f"\nNyeste gyldige maerke: klasse {nyeste.klassifikation}, gyldig til {nyeste.valid_to}")

    # Bekraeft "spoegelsesforslag" (Investment=0) er filtreret fra
    udloebet_maerke = next(m for m in maerker if m.label_status == "EXPIRED")
    assert len(udloebet_maerke.forslag) == 1, (
        f"FEJL: forventede 1 forslag efter filter (Investment>0) paa udloebet maerke, "
        f"fik {len(udloebet_maerke.forslag)}"
    )
    print(f"Udloebet maerke: {len(udloebet_maerke.forslag)} forslag efter Investment>0 filter (forventet 1)")

    # Bekraeft kategori-mapping virker
    fra_kategori_mapping = {f.seeb_beskrivelse: f.kategori for f in nyeste.forslag}
    print(f"\nKategori-mapping for nyeste maerke:")
    for seeb, kat in fra_kategori_mapping.items():
        print(f"  {seeb!r} -> {kat}")

    assert fra_kategori_mapping["Massive ydervægge"] == "isolering_facade"
    assert fra_kategori_mapping["Vinduer"] == "vinduer"

    # Bekraeft prioritering: Profitable=True foerst
    from analyse_engine import prioriter_energiforslag

    forslag_dicts = [
        {
            "headline": f.headline,
            "investering_kr": f.investering_kr,
            "besparelse_kr_aar": f.besparelse_kr_aar,
            "profitabel": f.profitabel,
        }
        for f in nyeste.forslag
    ]
    prioriteret = prioriter_energiforslag(forslag_dicts)

    print(f"\nPrioriteret raekkefoelge (nyeste maerke):")
    for f in prioriteret:
        payback = f["investering_kr"] / f["besparelse_kr_aar"] if f["besparelse_kr_aar"] else None
        print(f"  {f['prioritet']}. profitabel={f['profitabel']} payback={payback:.1f} aar  {f['headline'][:50]}")

    assert prioriteret[0]["profitabel"] is True, "FEJL: foerste prioritet skal vaere profitabel"
    # Det ikke-profitable forslag (vinduer) skal ligge sidst
    assert prioriteret[-1]["profitabel"] is False, "FEJL: ikke-profitabelt forslag skal ligge sidst"

    print("\n✓ Alle assertions bestaaet")


if __name__ == "__main__":
    main()

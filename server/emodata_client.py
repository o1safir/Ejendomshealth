"""
emodata_client.py

Klient til Energistyrelsens EMOData-service.
Adgang kræver godkendelse via emo-info@ens.dk (basic auth, ikke API-nøgle i URL).

VIGTIGT: Dette er en skeleton baseret på den dokumenterede adgangsmodel
(brugernavn/password, test/produktion-miljø, XSD-skema). Det faktiske
endpoint-format bekræftes først når I har modtaget vejledningen
"Test og brug af EMOData" fra Energistyrelsen.
"""

import os
from dataclasses import dataclass
from typing import Optional
import httpx


@dataclass
class EnergiforslagRaw:
    beskrivelse: str
    kategori: str
    investering_kr: Optional[float]
    besparelse_kr_aar: Optional[float]


@dataclass
class EnergimaerkeRaw:
    maerke: str
    energiforbrug_kwh_m2_aar: float
    udstedelsesdato: str
    gyldig_til: str
    forslag: list[EnergiforslagRaw]
    raa_respons: dict


class EMODataClient:
    """
    Klient til EMOData. Brug debug-miljø under udvikling,
    skift til produktion når I har valideret feltmapping.
    """

    def __init__(self, username: str | None = None, password: str | None = None,
                 environment: str = "debug"):
        self.username = username or os.environ["EMODATA_USERNAME"]
        self.password = password or os.environ["EMODATA_PASSWORD"]
        self.environment = environment
        # Faktisk base_url bekræftes via vejledningen fra Energistyrelsen
        self.base_url = (
            "https://emoweb.dk/emodata/test"
            if environment == "debug"
            else "https://emoweb.dk/emodata/production"
        )

    def hent_energimaerke(self, adresse: str, postnummer: str) -> Optional[EnergimaerkeRaw]:
        """
        Slår energimærke op på adresse. Returnerer None hvis intet mærke findes
        (relevant for ældre bygninger der aldrig er blevet mærket, eller hvor
        mærket deles med en anden bygning, jf. rækkehus/etageejendom-tilfælde).
        """
        with httpx.Client(auth=(self.username, self.password), timeout=30) as client:
            response = client.get(
                f"{self.base_url}/search",
                params={"adresse": adresse, "postnummer": postnummer},
            )
            response.raise_for_status()
            data = response.json()

        if not data.get("energimaerke"):
            return None

        return self._parse_response(data)

    def hent_fleradresser(self, adresser: list[tuple[str, str]]) -> list[EnergimaerkeRaw]:
        """
        Batch-opslag via fleradressesøgning. Brug Excel-skabelonen fra
        Energistyrelsen som reference for det forventede inputformat
        hvis I vil køre store batches uden for dette API.
        """
        resultater = []
        for adresse, postnummer in adresser:
            mærke = self.hent_energimaerke(adresse, postnummer)
            if mærke:
                resultater.append(mærke)
        return resultater

    def _parse_response(self, data: dict) -> EnergimaerkeRaw:
        forslag = [
            EnergiforslagRaw(
                beskrivelse=f["beskrivelse"],
                kategori=self._map_kategori(f.get("type", "")),
                investering_kr=f.get("investering"),
                besparelse_kr_aar=f.get("besparelse"),
            )
            for f in data.get("forbedringsforslag", [])
        ]

        em = data["energimaerke"]
        return EnergimaerkeRaw(
            maerke=em["maerke"],
            energiforbrug_kwh_m2_aar=em["energiforbrug"],
            udstedelsesdato=em["udstedelsesdato"],
            gyldig_til=em["gyldigTil"],
            forslag=forslag,
            raa_respons=data,
        )

    @staticmethod
    def _map_kategori(emo_type: str) -> str:
        """Mapper EMO's interne typekoder til vores kategori-enum. Udfyld
        efter I har set faktiske værdier fra testmiljøet."""
        mapping = {
            "tag": "isolering_tag",
            "facade": "isolering_facade",
            "gulv": "isolering_gulv",
            "vindue": "vinduer",
            "varme": "varmeanlaeg",
            "ventilation": "ventilation",
            "sol": "solceller",
        }
        return mapping.get(emo_type.lower(), "andet")

"""
bbr_client.py

Klient til BBR-tjenesten på Datafordeleren.
Adgang oprettes via datafordeler.dk, separat bruger pr. tjeneste
(BBR, CVR, EJF kræver hver sin godkendelse selvom de deles via samme login).

Metoder følger Datafordelerens servicekatalog: bbrsag, bygning,
ejendomsrelation, enhed, grund, tekniskanlaeg.
"""

import os
from dataclasses import dataclass
from typing import Optional
import httpx


@dataclass
class BBRBygning:
    opfoerelsesaar: Optional[int]
    ombygningsaar: Optional[int]
    ydervaeggsmateriale_kode: Optional[str]
    tagdaekningsmateriale_kode: Optional[str]
    varmeinstallation_kode: Optional[str]
    supplerende_varme_kode: Optional[str]
    bebygget_areal: Optional[float]
    antal_etager: Optional[int]
    har_kaelder: bool
    raa_respons: dict


@dataclass
class BBREnhed:
    boligareal: Optional[float]
    erhvervsareal: Optional[float]
    anvendelse_kode: Optional[str]
    antal_rum: Optional[int]
    antal_vaerelser: Optional[int]
    raa_respons: dict


class BBRClient:
    """
    Klient til Datafordelerens BBR-tjeneste.
    base_url og auth-metode bekræftes ved oprettelse af bruger på
    datafordeler.dk, formatet herunder følger den dokumenterede REST-struktur.
    """

    def __init__(self, username: str | None = None, password: str | None = None):
        self.username = username or os.environ["DATAFORDELER_USERNAME"]
        self.password = password or os.environ["DATAFORDELER_PASSWORD"]
        self.base_url = "https://services.datafordeler.dk/BBR/BBRPublic/1"

    def hent_bygning_paa_bfe(self, bfe_nummer: str) -> list[BBRBygning]:
        """Henter alle bygninger tilknyttet et BFE-nummer (en grund kan have flere bygninger)."""
        params = {
            "BFEnummer": bfe_nummer,
            "username": self.username,
            "password": self.password,
        }
        with httpx.Client(timeout=30) as client:
            response = client.get(f"{self.base_url}/bygning", params=params)
            response.raise_for_status()
            data = response.json()

        return [self._parse_bygning(b) for b in data.get("features", data if isinstance(data, list) else [])]

    def hent_enheder_paa_bfe(self, bfe_nummer: str) -> list[BBREnhed]:
        """Henter boligenheder, relevant for lejligheder/etageejendomme med flere enheder pr. bygning."""
        params = {
            "BFEnummer": bfe_nummer,
            "username": self.username,
            "password": self.password,
        }
        with httpx.Client(timeout=30) as client:
            response = client.get(f"{self.base_url}/enhed", params=params)
            response.raise_for_status()
            data = response.json()

        return [self._parse_enhed(e) for e in data.get("features", data if isinstance(data, list) else [])]

    def slaa_bfe_op_paa_adresse(self, adresse: str, postnummer: str) -> Optional[str]:
        """
        Adresseopslag til BFE-nummer. I praksis ofte nemmere via DAWA
        (Danmarks Adressers Web API, gratis og uden godkendelse) end via
        Datafordelerens egen adressetjeneste, brug DAWA til dette opslag
        og kun Datafordeleren til selve BBR/CVR/EJF-data.
        """
        with httpx.Client(timeout=30) as client:
            response = client.get(
                "https://api.dataforsyningen.dk/adresser",
                params={"q": f"{adresse}, {postnummer}"},
            )
            response.raise_for_status()
            results = response.json()

        if not results:
            return None
        # DAWA returnerer adgangsadresse-id, som kobles til BFE via ejendomsrelation
        return results[0].get("adgangsadresse", {}).get("id")

    def _parse_bygning(self, raw: dict) -> BBRBygning:
        props = raw.get("properties", raw)
        return BBRBygning(
            opfoerelsesaar=props.get("byg026Opførelsesår"),
            ombygningsaar=props.get("byg027OmTilbygningsår"),
            ydervaeggsmateriale_kode=props.get("byg032YdervæggensMateriale"),
            tagdaekningsmateriale_kode=props.get("byg033Tagdækningsmateriale"),
            varmeinstallation_kode=props.get("byg036Varmeinstallation"),
            supplerende_varme_kode=props.get("byg037SupplerendeVarme"),
            bebygget_areal=props.get("byg038BebyggetAreal"),
            antal_etager=props.get("byg054AntalEtager"),
            har_kaelder=bool(props.get("byg130ArealAfLukketOverdækningAfKælder", 0)),
            raa_respons=raw,
        )

    def _parse_enhed(self, raw: dict) -> BBREnhed:
        props = raw.get("properties", raw)
        return BBREnhed(
            boligareal=props.get("enh026BoligAreal"),
            erhvervsareal=props.get("enh027ErhvervAreal"),
            anvendelse_kode=props.get("enh020EnhedensAnvendelse"),
            antal_rum=props.get("enh028AntalRum"),
            antal_vaerelser=props.get("enh029AntalVærelser"),
            raa_respons=raw,
        )

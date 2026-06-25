"""
emodata_client.py

Klient til Energistyrelsens EMOData-service.

Bekræftet mod et faktisk, udfyldt svar fra GetEnergyLabelImprovementSuggestions
(testet på Gersonsvej 37, 2900 Hellerup, 25. juni 2026).

Endpoint: GET https://emoweb.dk/EMOData/EMOData.svc/GetEnergyLabelImprovementSuggestions/{addressline}
Auth: HTTP Basic Auth
Adresseformat: "Vejnavn husnr, postnr by" (komma før postnummer er afgørende,
ren "Vejnavn husnr" uden postnummer/by giver ARGUMENT_ERROR)

Nøglefund fra det reelle svar:
- En adresse kan have FLERE energimærker over tid (forskellige LabelStatus:
  EXPIRED/VALID). Vi skal vælge det nyeste VALID mærke, ikke bare det første.
- Proposals indeholder Investment=0/Savings=0 "spøgelsesforslag" på udløbne
  mærker (samme tekst gentaget med forskellig SeebClassification), disse
  filtreres fra ved Investment > 0.
- SeebClassificationDescription giver dansk klartekst-kategori, bruges til
  at mappe til vores egen kategori-enum.
"""

import os
import re
from dataclasses import dataclass, field
from enum import IntEnum
import httpx


class StatusKode(IntEnum):
    UNSPECIFIED_ERROR = 0
    ACCESS_DENIED = 1
    POLICY_ERROR = 2
    RESULT_OK = 3
    RESULT_EMPTY = 4
    RESULT_COUNT_EXCEEDED = 5
    MAINTENANCE_MODE = 6
    ARGUMENT_ERROR = 7
    SERVICE_ERROR = 8
    BACKEND_UNAVAILABLE = 9
    NOT_SUPPORTED = 10
    HIDDEN = 11


# Mapper EMO's danske SeebClassificationDescription til vores kategori-enum
# (matcher 'kategori'-check-constraint i energiforslag-tabellen)
SEEB_KATEGORI_MAPPING = {
    "massive ydervægge": "isolering_facade",
    "kælder ydervægge": "isolering_facade",
    "loft": "isolering_tag",
    "etageadskillelse": "isolering_gulv",
    "vinduer": "vinduer",
    "yderdøre": "vinduer",          # døre håndteres sammen med vinduer i vores kategori-sæt
    "varmerør": "varmeanlaeg",
    "varmefordelingspumper": "varmeanlaeg",
    "varmtvandsrør": "varmeanlaeg",
    "varmtvandsbeholder": "varmeanlaeg",
}


def map_seeb_kategori(beskrivelse: str) -> str:
    return SEEB_KATEGORI_MAPPING.get(beskrivelse.strip().lower(), "andet")


@dataclass
class ForslagRaw:
    headline: str
    beskrivelse: str
    investering_kr: float
    besparelse_kr_aar: float
    energi_sparet_kwh: float
    levetid_aar: int
    profitabel: bool
    anbefalet: bool
    seeb_beskrivelse: str
    kategori: str  # afledt via map_seeb_kategori
    proposal_group_id: int


@dataclass
class EnergimaerkeRaw:
    energy_label_number: int
    bbr_number: str
    bfe_number: str
    klassifikation: str  # CurrentEnergyLabel, fx "C"
    label_status: str  # "VALID" | "EXPIRED" m.fl.
    valid_from: str  # "DD-MM-YYYY" som streng, parses senere
    valid_to: str
    demo_link: str
    pdf_link: str | None
    forslag: list[ForslagRaw] = field(default_factory=list)
    raa_respons: dict = field(default_factory=dict)


class EMODataError(Exception):
    def __init__(self, status_kode, status: str, besked: str):
        self.status_kode = status_kode
        self.status = status
        self.besked = besked
        super().__init__(f"EMOData fejl [{status}]: {besked or '(ingen besked)'}")


class EMODataClient:
    """
    Klient til EMOData. Bruger Basic Auth direkte, intet token-flow.
    """

    BASE_URL = "https://emoweb.dk/EMOData/EMOData.svc"

    def __init__(self, username: str | None = None, password: str | None = None):
        self.username = username or os.environ["EMODATA_USERNAME"]
        self.password = password or os.environ["EMODATA_PASSWORD"]

    def hent_forbedringsforslag(
        self, vejnavn: str, husnr: str, postnr: str, by: str
    ) -> list[EnergimaerkeRaw]:
        """
        Henter alle energimærker (inkl. udløbne) og deres forbedringsforslag
        for en adresse. Returnerer en liste sorteret nyeste ValidFrom først,
        så kald .nyeste_gyldige() for at få det relevante mærke til en rapport.

        Adresseformatet SKAL være "vejnavn husnr, postnr by", bekræftet ved test,
        uden komma giver ARGUMENT_ERROR.
        """
        addressline = f"{vejnavn} {husnr}, {postnr} {by}"
        url = f"{self.BASE_URL}/GetEnergyLabelImprovementSuggestions/{addressline}"

        with httpx.Client(auth=(self.username, self.password), timeout=30) as client:
            response = client.get(url)
            response.raise_for_status()
            data = response.json()

        result = data.get("GetEnergyLabelImprovementSuggestionsResult", {})
        status = result.get("Response", {})
        status_text = status.get("Status", "")

        if status_text == "RESULT_EMPTY" or result.get("NumberOfEnergyLabelsFound", 0) == 0:
            return []

        if status_text != "RESULT_OK":
            raise EMODataError(
                status.get("ErrorCode"), status_text, status.get("Message", "")
            )

        maerker = [self._parse_maerke(m) for m in result.get("EnergyLabels", [])]
        # Nyeste ValidFrom (DD-MM-YYYY) først
        maerker.sort(key=lambda m: self._parse_dansk_dato(m.valid_from), reverse=True)
        return maerker

    def nyeste_gyldige(self, maerker: list[EnergimaerkeRaw]) -> EnergimaerkeRaw | None:
        """Vælger det nyeste mærke med LabelStatus == VALID. Returnerer None
        hvis intet gyldigt mærke findes (alle er udløbet)."""
        gyldige = [m for m in maerker if m.label_status == "VALID"]
        return gyldige[0] if gyldige else None

    def _parse_maerke(self, raw: dict) -> EnergimaerkeRaw:
        forslag_raw = raw.get("Proposals", [])
        forslag = [
            self._parse_forslag(f)
            for f in forslag_raw
            if f.get("Investment", 0) > 0  # filtrerer "spøgelsesforslag" fra udløbne mærker
        ]

        return EnergimaerkeRaw(
            energy_label_number=raw.get("EnergyLabelNumber"),
            bbr_number=raw.get("BBRNumber", ""),
            bfe_number=raw.get("BFENumber", ""),
            klassifikation=raw.get("CurrentEnergyLabel", ""),
            label_status=raw.get("LabelStatus", ""),
            valid_from=raw.get("ValidFrom", ""),
            valid_to=raw.get("ValidTo", ""),
            demo_link=raw.get("DEMOLink", ""),
            pdf_link=raw.get("PDF"),
            forslag=forslag,
            raa_respons=raw,
        )

    def _parse_forslag(self, raw: dict) -> ForslagRaw:
        seeb_beskrivelse = raw.get("SeebClassificationDescription", "")
        return ForslagRaw(
            headline=raw.get("ProposalHeadline", "").strip(),
            beskrivelse=raw.get("ProposalText", "").strip(),
            investering_kr=float(raw.get("Investment", 0)),
            besparelse_kr_aar=float(raw.get("Savings", 0) or 0),
            energi_sparet_kwh=float(raw.get("EnergySaved", 0) or 0),
            levetid_aar=int(raw.get("LifeTime", 0) or 0),
            profitabel=bool(raw.get("Profitable", False)),
            anbefalet=raw.get("Recommended", "Not") != "Not",
            seeb_beskrivelse=seeb_beskrivelse,
            kategori=map_seeb_kategori(seeb_beskrivelse),
            proposal_group_id=raw.get("ProposalGroupID", 0),
        )

    @staticmethod
    def _parse_dansk_dato(dato_str: str):
        """Parser 'DD-MM-YYYY' til et sammenligneligt tuple, robust mod tom streng."""
        match = re.match(r"(\d{2})-(\d{2})-(\d{4})", dato_str or "")
        if not match:
            return (0, 0, 0)
        dag, mnd, aar = match.groups()
        return (int(aar), int(mnd), int(dag))



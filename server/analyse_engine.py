"""
analyse_engine.py

Jeres fortolkningslag. Tager rå BBR + EMOData og producerer struktureret
analyse_output, som rapport-templates renderer til PDF.

Dette er IKKE en gendistribution af myndighedsdata, det er en selvstændig
vurdering bygget på data, hvilket holder jer uden for "datadistributør"
-kategorien i OIS-bekendtgørelsen.
"""

from dataclasses import dataclass, field
from enum import Enum


class Boligtype(str, Enum):
    LEJLIGHED = "lejlighed"
    RAEKKEHUS = "raekkehus"
    VILLA = "villa"
    UDLEJNINGSEJENDOM = "udlejningsejendom"


# BR-perioder, bruges til at vurdere forventet klimaskærm-standard
# uden at skulle gætte ud fra materialekoder alene
BYGGEPERIODER = [
    (0, 1961, "foer_br_1961", "Ingen lovkrav om isolering, høj sandsynlighed for utæt klimaskærm"),
    (1961, 1979, "br_1961_1979", "Begrænsede isoleringskrav, ofte enkeltglas oprindeligt"),
    (1979, 1995, "br_1979_1995", "Markant skærpede isoleringskrav, rimelig standard hvis uændret"),
    (1995, 2006, "br_1995_2006", "God isoleringsstandard for perioden"),
    (2006, 2010, "br_2006_2010", "Energiklasse-krav indført, typisk C-niveau eller bedre"),
    (2010, 9999, "br_2010_nu", "Lavenergi-krav, typisk A/B-niveau ved opførelse"),
]


@dataclass
class AnalyseInput:
    boligtype: Boligtype
    opfoerelsesaar: int | None
    ombygningsaar: int | None
    boligareal: float | None
    varmeinstallation_kode: str | None
    energimaerke: str | None
    energiforslag: list[dict] = field(default_factory=list)  # fra energimaerke.energiforslag
    antal_enheder_paa_adresse: int = 1
    bbr_afvigelser: list[str] = field(default_factory=list)


@dataclass
class AnalyseOutput:
    samlet_score: int
    score_forklaring: str
    byggeperiode_label: str
    byggeperiode_forklaring: str
    prioriterede_forslag: list[dict]
    boligtype_anbefaling: dict
    juridiske_noter: list[str]


def find_byggeperiode(aar: int | None) -> tuple[str, str]:
    if aar is None:
        return "ukendt", "Opførelsesår ikke registreret i BBR"
    for start, slut, label, forklaring in BYGGEPERIODER:
        if start <= aar < slut:
            return label, forklaring
    return "ukendt", "Kunne ikke matche periode"


def beregn_score(input: AnalyseInput, byggeperiode_label: str) -> tuple[int, str]:
    """
    Simpel udgangsscore, justeres af jer i takt med at I har reelle
    sammenligningsdata. Tænk på dette som en startmodel, ikke et facit.
    """
    base_score = {
        "A2020": 95, "A2015": 90, "A2010": 85,
        "B": 75, "C": 60, "D": 45, "E": 30, "F": 20, "G": 10,
    }.get(input.energimaerke, 50)  # 50 = neutral hvis intet mærke

    # Justering hvis bygning er ombygget efter opførelse i ældre periode
    if input.ombygningsaar and input.opfoerelsesaar and input.ombygningsaar - input.opfoerelsesaar > 20:
        base_score = min(100, base_score + 5)
        forklaring_tillaeg = " Bygningen er ombygget væsentligt efter opførelse, hvilket typisk forbedrer klimaskærmen."
    else:
        forklaring_tillaeg = ""

    forklaring = f"Baseret på energimærke {input.energimaerke or 'ukendt'} og byggeperiode.{forklaring_tillaeg}"
    return base_score, forklaring


def prioriter_energiforslag(forslag: list[dict]) -> list[dict]:
    """
    Sorterer EMO's forbedringsforslag efter tilbagebetalingstid.
    Dette er den konkrete værditilvækst: EMO-rapporten lister forslag,
    men prioriterer dem ikke i forhold til hinanden.
    """
    def payback(f):
        besparelse = f.get("besparelse_kr_aar") or 0
        investering = f.get("investering_kr") or 0
        if besparelse <= 0:
            return float("inf")
        return investering / besparelse

    sorteret = sorted(forslag, key=payback)
    for i, f in enumerate(sorteret, start=1):
        f["prioritet"] = i
    return sorteret


def boligtype_anbefaling(input: AnalyseInput) -> dict:
    """
    Forgrener anbefalingslogik efter boligtype. Dette er kernen i,
    hvorfor en lejlighed og en udlejningsejendom ikke kan få samme rapport.
    """
    if input.boligtype == Boligtype.LEJLIGHED:
        return {
            "fokus": "faelles_klimaskaerm",
            "noter": [
                "Individuelle isoleringsforslag (tag, facade) kræver typisk "
                "beslutning i ejerforeningen, ikke den enkelte ejer.",
                "Vinduer og indvendige forhold kan ofte ændres uden "
                "ejerforeningsbeslutning, afhængig af vedtægter.",
            ],
            "relevant_for_enkeltejer": ["vinduer", "ventilation"],
            "relevant_for_ejerforening": ["isolering_tag", "isolering_facade", "varmeanlaeg"],
        }

    if input.boligtype in (Boligtype.VILLA, Boligtype.RAEKKEHUS):
        return {
            "fokus": "fuld_klimaskaerm_og_varme",
            "noter": [
                "Ejer har fuld beslutningskompetence over alle forbedringer.",
                "Skift til hydronisk gulvvarme i kombination med "
                "efterisolering giver ofte den bedste samlede effekt "
                "ved renovering af ældre ejendomme.",
            ],
            "relevant_for_enkeltejer": [
                "isolering_tag", "isolering_facade", "isolering_gulv",
                "vinduer", "varmeanlaeg",
            ],
        }

    if input.boligtype == Boligtype.UDLEJNINGSEJENDOM:
        return {
            "fokus": "roi_og_forbedringsforhoejelse",
            "noter": [
                "Energirenovering kan i visse tilfælde berettige til "
                "forbedringsforhøjelse af huslejen, vurderes konkret "
                "efter boligreguleringslovens regler.",
                "ROI bør beregnes som kombination af huslejeforhøjelse "
                "og reduceret tomgang, ikke kun direkte energibesparelse.",
            ],
            "relevant_for_udlejer": [
                "isolering_tag", "isolering_facade", "varmeanlaeg", "vinduer",
            ],
            "kraever_juridisk_vurdering": True,
        }

    return {"fokus": "generel", "noter": []}


def koer_analyse(input: AnalyseInput) -> AnalyseOutput:
    byggeperiode_label, byggeperiode_forklaring = find_byggeperiode(input.opfoerelsesaar)
    score, score_forklaring = beregn_score(input, byggeperiode_label)
    prioriterede = prioriter_energiforslag(input.energiforslag)
    boligtype_anb = boligtype_anbefaling(input)

    juridiske_noter = []
    if input.bbr_afvigelser:
        juridiske_noter.append(
            f"BBR-afvigelser identificeret: {', '.join(input.bbr_afvigelser)}. "
            "Bør undersøges før evt. salg, da uregistrerede forhold kan "
            "indikere ikke-lovligt udført byggeri."
        )
    if input.boligtype == Boligtype.UDLEJNINGSEJENDOM:
        juridiske_noter.append(
            "Forbedringer der ønskes finansieret via huslejeforhøjelse "
            "kræver forudgående varsling og kan indbringes for "
            "huslejenævnet, jf. praksis fra tidligere sager."
        )

    return AnalyseOutput(
        samlet_score=score,
        score_forklaring=score_forklaring,
        byggeperiode_label=byggeperiode_label,
        byggeperiode_forklaring=byggeperiode_forklaring,
        prioriterede_forslag=prioriterede,
        boligtype_anbefaling=boligtype_anb,
        juridiske_noter=juridiske_noter,
    )

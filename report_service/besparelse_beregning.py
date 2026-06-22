"""
Besparelsesberegning — matcher Core Partners hjemmeside (corepartners.html) 1:1.
TypeScript-versionen (src/lib/besparelseBeregning.ts) SKAL matche denne logik.

Ændres kun i BEGGE filer på én gang.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

# Servicemix-vægt pr. kategori — højere vægt = historisk større optimeringspotentiale
KATEGORI_VAEGT: dict[str, float] = {
    "Forsikringer":       0.018,
    "Serviceaftaler":     0.012,
    "Vedligehold":        0.012,
    "Vagt & sikkerhed":   0.012,
    "Rengøring":          0.010,
    "IT & telefoni":      0.008,
    "Andet":              0.008,
    "Energi & forsyning": 0.004,
}


def _aar_siden(dato_str: str | None) -> float | None:
    if not dato_str:
        return None
    d = datetime.strptime(dato_str, "%Y-%m-%d").date()
    return (date.today() - d).days / 365.25


def _rate_for_alder(aar: float) -> float:
    if aar < 1:
        return 0.02
    if aar < 2:
        return 0.05
    if aar < 4:
        return 0.09
    return 0.13


def _urgency_for_rf(rf: float) -> str:
    if rf < 0.06:
        return "ingen"
    if rf < 0.10:
        return "lav"
    if rf < 0.14:
        return "middel"
    return "høj"


def beregn_besparelse(aftaler: list[dict[str, Any]], intern_indkoeb: bool = False) -> dict[str, Any] | None:
    if not aftaler:
        return None

    total = sum(a.get("nuvaerende_pris") or 0 for a in aftaler)
    if total <= 0:
        return None

    # Servicemix-vægt (cw): vægtet gennemsnit af kategoriernes bidrag ift. omsætning
    cw_taeller = sum(
        (a.get("nuvaerende_pris") or 0) * KATEGORI_VAEGT.get(a.get("kategori", ""), 0.008)
        for a in aftaler
    )
    cw = cw_taeller / total

    # Baserate fra ældste genforhandling
    aldre = [x for x in (_aar_siden(a.get("sidst_genforhandlet")) for a in aftaler) if x is not None]
    aeldste_aar = max(aldre) if aldre else 4.0
    rate = _rate_for_alder(aeldste_aar)

    # Indkøbsfunktionsjustering (ejendoms-niveau, ikke per-aftale)
    buying = -0.04 if intern_indkoeb else 0.04

    # Samlet besparelsesrate — min 4%, max 22%
    rf = min(0.22, max(0.04, rate + cw + buying))

    high = round(total * rf)
    low = round(total * max(0.03, rf - 0.025))
    mid = round((low + high) / 2)
    honorar = round(mid * 0.20)
    netto = mid - honorar

    low_pct = round(max(0.03, rf - 0.025) * 100)
    high_pct = round(rf * 100)

    return {
        "min_besparelse": low,
        "max_besparelse": high,
        "median_besparelse": mid,
        "besparelses_procent_spaend": f"{low_pct}-{high_pct}%",
        "honorar": honorar,
        "netto": netto,
        "urgency": _urgency_for_rf(rf),
    }

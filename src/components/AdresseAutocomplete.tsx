import { useEffect, useRef, useState } from "react";

export interface DawaAdresse {
  id: string;               // adgangsadresse-id, bruges senere til BFE/BBR-opslag
  vejnavn: string;
  husnr: string;
  etage: string | null;
  doer: string | null;
  postnr: string;
  postnrnavn: string;       // by
  visningstekst: string;    // fuld formateret adresse til UI
}

interface Props {
  onVælg: (adresse: DawaAdresse) => void;
  initialVærdi?: string;
}

/**
 * DAWA er Danmarks Adressers Web API, gratis og uden godkendelse,
 * driftet af Klimadatastyrelsen. Bruges her kun til adresseopslag,
 * selve BBR/EMOData-opslaget sker server-side med adgangsadresse-id'et.
 */
export default function AdresseAutocomplete({ onVælg, initialVærdi = "" }: Props) {
  const [query, setQuery] = useState(initialVærdi);
  const [forslag, setForslag] = useState<DawaAdresse[]>([]);
  const [åben, setÅben] = useState(false);
  const [henter, setHenter] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setÅben(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function håndterInput(værdi: string) {
    setQuery(værdi);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (værdi.trim().length < 3) {
      setForslag([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setHenter(true);
      try {
        const response = await fetch(
          `https://api.dataforsyningen.dk/adresser/autocomplete?q=${encodeURIComponent(værdi)}&per_side=8`
        );
        const data = await response.json();

        const parsed: DawaAdresse[] = data.map((item: any) => ({
          id: item.adresse.id,
          vejnavn: item.adresse.vejnavn,
          husnr: item.adresse.husnr,
          etage: item.adresse.etage,
          doer: item.adresse.dør,
          postnr: item.adresse.postnr,
          postnrnavn: item.adresse.postnrnavn,
          visningstekst: item.tekst,
        }));

        setForslag(parsed);
        setÅben(true);
      } catch (err) {
        setForslag([]);
      } finally {
        setHenter(false);
      }
    }, 250);
  }

  function håndterVælg(adresse: DawaAdresse) {
    setQuery(adresse.visningstekst);
    setÅben(false);
    setForslag([]);
    onVælg(adresse);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={query}
        onChange={(e) => håndterInput(e.target.value)}
        onFocus={() => forslag.length > 0 && setÅben(true)}
        placeholder="Begynd at skrive adresse, f.eks. Gersonsvej 37"
        className="w-full border border-line rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent"
        autoComplete="off"
      />

      {henter && (
        <div className="absolute right-3 top-2.5 text-xs text-slate font-mono">
          søger…
        </div>
      )}

      {åben && forslag.length > 0 && (
        <ul className="absolute z-20 w-full bg-white border border-line rounded mt-1 shadow-lg max-h-64 overflow-auto">
          {forslag.map((adresse) => (
            <li
              key={adresse.id}
              onClick={() => håndterVælg(adresse)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-paper border-b border-line last:border-b-0"
            >
              {adresse.visningstekst}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, Boligtype, RapportType } from "../lib/supabase";
import AdresseAutocomplete, { DawaAdresse } from "../components/AdresseAutocomplete";

export default function NyEjendom() {
  const navigate = useNavigate();
  const [valgtAdresse, setValgtAdresse] = useState<DawaAdresse | null>(null);
  const [boligtype, setBoligtype] = useState<Boligtype>("villa");
  const [rapportType, setRapportType] = useState<RapportType>("privat");
  const [gemmer, setGemmer] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!valgtAdresse) {
      setFejl("Vælg en adresse fra listen, så den kan slås op korrekt i BBR.");
      return;
    }

    setGemmer(true);
    setFejl(null);

    const adresseLinje = `${valgtAdresse.vejnavn} ${valgtAdresse.husnr}${
      valgtAdresse.etage ? `, ${valgtAdresse.etage}.` : ""
    }${valgtAdresse.doer ? ` ${valgtAdresse.doer}` : ""}`;

    const { data, error } = await supabase
      .from("ejendomme")
      .insert({
        adresse: adresseLinje,
        vejnavn: valgtAdresse.vejnavn,
        husnummer: valgtAdresse.husnr,
        postnummer: valgtAdresse.postnr,
        by: valgtAdresse.postnrnavn,
        dawa_adgangsadresse_id: valgtAdresse.id,
        boligtype,
        rapport_type: rapportType,
        antal_enheder_paa_adresse: 1,
      })
      .select()
      .single();

    if (error) {
      setFejl(error.message);
      setGemmer(false);
      return;
    }

    // Opret den tilhørende rapport-række, status 'afventer'
    await supabase.from("rapporter").insert({
      ejendom_id: data.id,
      rapport_type: rapportType,
      status: "afventer",
    });

    navigate(`/ejendom/${data.id}`);
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl mb-1">Ny ejendom</h1>
      <p className="text-slate font-body text-sm mb-8">
        Opret en ejendom for at trække grunddata og generere en rapport.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5 font-body">
        <div>
          <label className="block text-sm font-medium mb-1">Adresse</label>
          <AdresseAutocomplete onVælg={setValgtAdresse} />
          <p className="text-xs text-slate mt-1">
            Slår op mod DAWA (offentligt adresseregister). Postnummer og by
            udfyldes automatisk ved valg.
          </p>
        </div>

        {valgtAdresse && (
          <div className="text-sm bg-accent/10 border border-accent/30 rounded px-3 py-2">
            <span className="text-slate">Valgt: </span>
            {valgtAdresse.visningstekst}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Boligtype</label>
          <select
            value={boligtype}
            onChange={(e) => setBoligtype(e.target.value as Boligtype)}
            className="w-full border border-line rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="villa">Villa</option>
            <option value="raekkehus">Rækkehus</option>
            <option value="lejlighed">Lejlighed</option>
            <option value="udlejningsejendom">Udlejningsejendom</option>
            <option value="andet">Andet</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Rapporttype</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setRapportType("privat")}
              className={`flex-1 border rounded px-3 py-2 text-sm transition-colors ${
                rapportType === "privat"
                  ? "border-accent bg-accent/10 text-accent font-medium"
                  : "border-line text-slate"
              }`}
            >
              Privat (boligejer/køber)
            </button>
            <button
              type="button"
              onClick={() => setRapportType("investor")}
              className={`flex-1 border rounded px-3 py-2 text-sm transition-colors ${
                rapportType === "investor"
                  ? "border-accent bg-accent/10 text-accent font-medium"
                  : "border-line text-slate"
              }`}
            >
              Investor/udlejer
            </button>
          </div>
        </div>

        {fejl && <p className="text-warn text-sm">{fejl}</p>}

        <button
          type="submit"
          disabled={gemmer}
          className="w-full bg-accent text-paper py-2.5 rounded font-medium hover:bg-ink transition-colors disabled:opacity-50"
        >
          {gemmer ? "Opretter…" : "Opret og hent data"}
        </button>
      </form>
    </div>
  );
}

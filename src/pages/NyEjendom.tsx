import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, Boligtype, RapportType } from "../lib/supabase";

export default function NyEjendom() {
  const navigate = useNavigate();
  const [adresse, setAdresse] = useState("");
  const [postnummer, setPostnummer] = useState("");
  const [by, setBy] = useState("");
  const [boligtype, setBoligtype] = useState<Boligtype>("villa");
  const [rapportType, setRapportType] = useState<RapportType>("privat");
  const [gemmer, setGemmer] = useState(false);
  const [fejl, setFejl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGemmer(true);
    setFejl(null);

    const { data, error } = await supabase
      .from("ejendomme")
      .insert({
        adresse,
        postnummer,
        by,
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
          <input
            required
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            placeholder="Strandvejen 100"
            className="w-full border border-line rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Postnummer</label>
            <input
              required
              value={postnummer}
              onChange={(e) => setPostnummer(e.target.value)}
              placeholder="2900"
              className="w-full border border-line rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="flex-[2]">
            <label className="block text-sm font-medium mb-1">By</label>
            <input
              required
              value={by}
              onChange={(e) => setBy(e.target.value)}
              placeholder="Hellerup"
              className="w-full border border-line rounded px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

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

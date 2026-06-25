import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, Ejendom, Rapport } from "../lib/supabase";

interface EjendomMedRapport extends Ejendom {
  rapporter: Rapport[];
}

const BOLIGTYPE_LABEL: Record<string, string> = {
  lejlighed: "Lejlighed",
  raekkehus: "Rækkehus",
  villa: "Villa",
  udlejningsejendom: "Udlejningsejendom",
  andet: "Andet",
};

const STATUS_LABEL: Record<string, { tekst: string; klasse: string }> = {
  afventer: { tekst: "Afventer", klasse: "text-slate" },
  genereres: { tekst: "Genereres", klasse: "text-warn" },
  klar: { tekst: "Klar", klasse: "text-good" },
  fejlet: { tekst: "Fejlet", klasse: "text-red-700" },
};

export default function Dashboard() {
  const [ejendomme, setEjendomme] = useState<EjendomMedRapport[]>([]);
  const [loading, setLoading] = useState(true);
  const [fejl, setFejl] = useState<string | null>(null);

  useEffect(() => {
    hentEjendomme();
  }, []);

  async function hentEjendomme() {
    setLoading(true);
    const { data, error } = await supabase
      .from("ejendomme")
      .select("*, rapporter(*)")
      .order("oprettet_at", { ascending: false });

    if (error) {
      setFejl(error.message);
    } else {
      setEjendomme((data as EjendomMedRapport[]) ?? []);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 font-mono text-sm text-slate">
        Henter ejendomme…
      </div>
    );
  }

  if (fejl) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12">
        <p className="font-body text-warn">
          Kunne ikke hente ejendomme: {fejl}
        </p>
      </div>
    );
  }

  if (ejendomme.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <p className="font-display text-2xl mb-2">Ingen ejendomme endnu</p>
        <p className="font-body text-slate mb-6">
          Opret den første ejendom for at generere en rapport.
        </p>
        <Link
          to="/ny"
          className="inline-block bg-accent text-paper px-5 py-2.5 rounded font-body text-sm hover:bg-ink transition-colors"
        >
          Opret ejendom
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="font-display text-3xl">Ejendomme</h1>
        <Link
          to="/ny"
          className="bg-accent text-paper px-4 py-2 rounded font-body text-sm hover:bg-ink transition-colors"
        >
          + Ny rapport
        </Link>
      </div>

      <table className="w-full text-sm font-body">
        <thead>
          <tr className="border-b border-line text-left text-slate font-mono text-xs uppercase tracking-wide">
            <th className="py-2 pr-4">Adresse</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Rapport</th>
            <th className="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody>
          {ejendomme.map((e) => {
            const seneste = e.rapporter?.[e.rapporter.length - 1];
            const status = seneste
              ? STATUS_LABEL[seneste.status]
              : { tekst: "Ingen rapport", klasse: "text-slate" };

            return (
              <tr
                key={e.id}
                className="border-b border-line hover:bg-white/60 transition-colors"
              >
                <td className="py-3 pr-4">
                  <Link to={`/ejendom/${e.id}`} className="hover:text-accent">
                    {e.adresse}, {e.postnummer} {e.by}
                  </Link>
                </td>
                <td className="py-3 pr-4 text-slate">
                  {BOLIGTYPE_LABEL[e.boligtype]}
                </td>
                <td className="py-3 pr-4 text-slate capitalize">
                  {e.rapport_type}
                </td>
                <td className={`py-3 pr-4 font-medium ${status.klasse}`}>
                  {status.tekst}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase, Ejendom, Rapport } from "../lib/supabase";

interface EnergiforslagRad {
  id: string;
  headline: string;
  kategori: string;
  investering_kr: number;
  besparelse_kr_aar: number;
  profitabel: boolean;
  prioritet: number | null;
}

interface AnalyseOutput {
  samlet_score: number;
  score_forklaring: string;
  boligtype_anbefaling: any;
  juridiske_noter: string[] | null;
}

export default function EjendomDetalje() {
  const { id } = useParams<{ id: string }>();
  const [ejendom, setEjendom] = useState<Ejendom | null>(null);
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseOutput | null>(null);
  const [forslag, setForslag] = useState<EnergiforslagRad[]>([]);
  const [energimaerke, setEnergimaerke] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [genererer, setGenererer] = useState(false);

  useEffect(() => {
    if (id) hentData(id);
  }, [id]);

  async function hentData(ejendomId: string) {
    setLoading(true);
    const [{ data: e }, { data: r }] = await Promise.all([
      supabase.from("ejendomme").select("*").eq("id", ejendomId).single(),
      supabase
        .from("rapporter")
        .select("*")
        .eq("ejendom_id", ejendomId)
        .order("oprettet_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setEjendom(e);
    setRapport(r);

    // Hvis rapporten er klar, hent også selve analyseresultatet og forslagene,
    // så vi kan vise dem inline (vi har endnu ikke PDF-generering bygget)
    if (r?.status === "klar" && r.analyse_output_id) {
      const { data: a } = await supabase
        .from("analyse_output")
        .select("samlet_score, score_forklaring, boligtype_anbefaling, juridiske_noter")
        .eq("id", r.analyse_output_id)
        .maybeSingle();
      setAnalyse(a);

      const { data: em } = await supabase
        .from("energimaerke")
        .select("id, maerke")
        .eq("ejendom_id", ejendomId)
        .order("hentet_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setEnergimaerke(em?.maerke ?? null);

      if (em?.id) {
        const { data: f } = await supabase
          .from("energiforslag")
          .select("id, headline, kategori, investering_kr, besparelse_kr_aar, profitabel, prioritet")
          .eq("energimaerke_id", em.id)
          .order("prioritet", { ascending: true, nullsFirst: false });
        setForslag(f ?? []);
      }
    } else {
      setAnalyse(null);
      setForslag([]);
      setEnergimaerke(null);
    }

    setLoading(false);
  }

  async function startGenerering() {
    if (!ejendom || !rapport) return;
    setGenererer(true);

    await supabase
      .from("rapporter")
      .update({ status: "genereres" })
      .eq("id", rapport.id);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_REPORT_SERVICE_URL}/generer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ejendom_id: ejendom.id, rapport_id: rapport.id }),
        }
      );
      if (!response.ok) throw new Error(await response.text());
    } catch (err) {
      await supabase
        .from("rapporter")
        .update({ status: "fejlet" })
        .eq("id", rapport.id);
    }

    await hentData(ejendom.id);
    setGenererer(false);
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 font-mono text-sm text-slate">
        Henter…
      </div>
    );
  }

  if (!ejendom) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-warn">Ejendom ikke fundet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-display text-3xl mb-1">{ejendom.adresse}</h1>
      <p className="text-slate font-body mb-8">
        {ejendom.postnummer} {ejendom.by} · {ejendom.boligtype} ·{" "}
        {ejendom.rapport_type === "privat" ? "Privat rapport" : "Investorrapport"}
      </p>

      <div className="border border-line rounded-lg p-6 bg-white mb-6">
        <h2 className="font-display text-lg mb-3">Rapportstatus</h2>

        {rapport?.status === "klar" ? (
          <div>
            <p className="text-good font-medium mb-1">Rapport er klar</p>
            <p className="text-slate text-sm">
              PDF-eksport er ikke bygget endnu, analyseresultatet vises herunder.
            </p>
          </div>
        ) : rapport?.status === "genereres" || genererer ? (
          <p className="text-warn font-mono text-sm">
            Genererer rapport, henter BBR og energimærke…
          </p>
        ) : rapport?.status === "fejlet" ? (
          <div>
            <p className="text-red-700 mb-3">
              Generering mislykkedes. Tjek at BBR/EMOData-adgang er korrekt
              konfigureret i report-service.
            </p>
            <button
              onClick={startGenerering}
              className="bg-accent text-paper px-4 py-2 rounded text-sm hover:bg-ink transition-colors"
            >
              Forsøg igen
            </button>
          </div>
        ) : (
          <button
            onClick={startGenerering}
            className="bg-accent text-paper px-4 py-2 rounded text-sm hover:bg-ink transition-colors"
          >
            Generer rapport
          </button>
        )}
      </div>

      {analyse && (
        <div className="border border-line rounded-lg p-6 bg-white mb-6">
          <h2 className="font-display text-lg mb-3">Analyse</h2>
          <div className="flex items-baseline gap-3 mb-2">
            <span className="font-display text-3xl">{analyse.samlet_score}</span>
            <span className="text-slate text-sm">/ 100</span>
            {energimaerke && (
              <span className="ml-auto bg-accent/10 text-accent px-2 py-1 rounded text-sm font-medium">
                Energimærke {energimaerke}
              </span>
            )}
          </div>
          <p className="text-slate text-sm">{analyse.score_forklaring}</p>

          {analyse.juridiske_noter && analyse.juridiske_noter.length > 0 && (
            <div className="mt-4 pt-4 border-t border-line">
              <p className="text-sm font-medium mb-1">Bemærkninger</p>
              {analyse.juridiske_noter.map((note, i) => (
                <p key={i} className="text-sm text-slate">{note}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {forslag.length > 0 && (
        <div className="border border-line rounded-lg p-6 bg-white">
          <h2 className="font-display text-lg mb-3">Forbedringsforslag</h2>
          <p className="text-slate text-sm mb-4">
            Prioriteret efter rentabilitet (EMOData)
          </p>
          <div className="space-y-3">
            {forslag.map((f) => {
              const payback = f.besparelse_kr_aar > 0 ? f.investering_kr / f.besparelse_kr_aar : null;
              return (
                <div key={f.id} className="border border-line rounded p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{f.headline}</p>
                    {f.profitabel && (
                      <span className="text-xs bg-good/10 text-good px-2 py-0.5 rounded shrink-0">
                        Rentabel
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-slate font-mono">
                    <span>Investering: {f.investering_kr.toLocaleString("da-DK")} kr</span>
                    <span>Besparelse: {f.besparelse_kr_aar.toLocaleString("da-DK")} kr/år</span>
                    {payback && <span>Payback: {payback.toFixed(1)} år</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

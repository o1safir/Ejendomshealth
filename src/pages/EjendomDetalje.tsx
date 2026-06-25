import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase, Ejendom, Rapport } from "../lib/supabase";

export default function EjendomDetalje() {
  const { id } = useParams<{ id: string }>();
  const [ejendom, setEjendom] = useState<Ejendom | null>(null);
  const [rapport, setRapport] = useState<Rapport | null>(null);
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
    setLoading(false);
  }

  async function startGenerering() {
    if (!ejendom || !rapport) return;
    setGenererer(true);

    // Kalder report-service (Render). Selve datatræk + analyse sker server-side,
    // se server/main.py. Her sættes blot status, så UI kan vise fremdrift.
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

      <div className="border border-line rounded-lg p-6 bg-white">
        <h2 className="font-display text-lg mb-3">Rapportstatus</h2>

        {rapport?.status === "klar" && rapport.pdf_storage_path ? (
          <div>
            <p className="text-good font-medium mb-3">Rapport er klar</p>
            <a
              href={rapport.pdf_storage_path}
              target="_blank"
              rel="noreferrer"
              className="inline-block bg-accent text-paper px-4 py-2 rounded text-sm hover:bg-ink transition-colors"
            >
              Download PDF
            </a>
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
    </div>
  );
}

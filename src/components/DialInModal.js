import { useState, useEffect, useRef } from "react";
import { getSupabase } from "../lib/supabase";
import { getRecipes, newRecipeId } from "../lib/recipes";
import { findPreviousGrindSettings } from "../lib/grindPredictor";

// Collect grind settings the user already dialed for this or similar coffees.
function gatherPriorGrinds(coffee, allCoffees) {
  const grinds = getRecipes(coffee).map((r) => r.grind).filter(Boolean);
  const prev = findPreviousGrindSettings(coffee, allCoffees || []);
  if (prev?.grind) grinds.push(prev.grind);
  return [...new Set(grinds)];
}

function RecipePreviewCard({ recipe, selected, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: "12px 14px",
        marginBottom: 10,
        background: "linear-gradient(135deg, #FDF8F4 0%, #FAF0E6 100%)",
        border: `2px solid ${selected ? "var(--accent-dark)" : "var(--accent-light, #E8D5C4)"}`,
        borderRadius: 10,
        cursor: "pointer",
        opacity: selected ? 1 : 0.55,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-dark)" }}>
          {selected ? "☑" : "☐"} {recipe.name || "Recipe"}
        </span>
        {recipe.grind && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", background: "var(--accent-dark)", borderRadius: 5 }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Grind</span>
            <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "#fff" }}>{recipe.grind}</span>
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, fontFamily: "'DM Mono', monospace", color: "var(--text)" }}>
        {(recipe.dose || recipe.yield) && <span>{recipe.dose || "—"}g → {recipe.yield || "—"}g</span>}
        {recipe.totalTime && <span>{recipe.totalTime}s</span>}
        {(recipe.preInfuse || recipe.brewTime) && <span style={{ color: "var(--muted)" }}>pre {recipe.preInfuse || "—"}s · full {recipe.brewTime || "—"}s</span>}
        {recipe.temp && <span>{recipe.temp}°{recipe.tempUnit || "C"}</span>}
        {recipe.feedSpeed && <span style={{ textTransform: "capitalize" }}>{recipe.feedSpeed}</span>}
      </div>
      {recipe.notes && (
        <div style={{ marginTop: 8, fontSize: 11, fontStyle: "italic", color: "var(--muted)" }}>"{recipe.notes}"</div>
      )}
    </div>
  );
}

export function DialInModal({ coffee, baseline, allCoffees, onApply, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [pick, setPick] = useState({ espresso: true, flatWhite: true });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: { session } = {} } = (await supabase?.auth.getSession()) || {};
        const token = session?.access_token;
        if (!token) { setError("Please sign in again."); setLoading(false); return; }

        const res = await fetch("/api/dial-in", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: coffee.name, country: coffee.country, region: coffee.region,
            variety: coffee.variety, producer: coffee.producer, roaster: coffee.roaster,
            roastLevel: coffee.roastLevel, process: coffee.process,
            altitude: coffee.altitude, altitudeCategory: coffee.altitudeCategory,
            tastingNotes: coffee.tastingNotes, roastDate: coffee.roastDate,
            weight: coffee.weight, doseG: coffee.doseG,
            baselineGrind: baseline ?? undefined,
            priorGrinds: gatherPriorGrinds(coffee, allCoffees),
          }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Dial-in failed."); setLoading(false); return; }
        setResult(data);
        setPick({ espresso: !!data.espresso, flatWhite: !!data.flatWhite });
      } catch (err) {
        setError(err.message || "Dial-in failed.");
      } finally {
        setLoading(false);
      }
    })();
  }, [coffee, baseline, allCoffees]);

  const save = () => {
    const chosen = [];
    if (pick.espresso && result.espresso) chosen.push({ ...result.espresso, id: newRecipeId() });
    if (pick.flatWhite && result.flatWhite) chosen.push({ ...result.flatWhite, id: newRecipeId() });
    if (chosen.length === 0) { onClose(); return; }
    // The parent merges against its current recipe list — this modal's `coffee`
    // is a 10–20s-old snapshot, so it must not be the source of the merge.
    onApply(chosen, result.insight || null);
    onClose();
  };

  const sheet = {
    width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto",
    background: "var(--bg, #fff)", borderRadius: "16px 16px 0 0", padding: "18px 18px 24px",
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1100 }} onClick={onClose}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-dark)" }}>🤖 AI Dial-In · {coffee.name || "Coffee"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "var(--muted)", cursor: "pointer" }}>×</button>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
            <div style={{ fontSize: 26, marginBottom: 10 }}>☕</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Researching this coffee…</div>
            <div style={{ fontSize: 11 }}>Looking up the farm, variety & producer, then dialing recipes for your Slayer. ~10–20s.</div>
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: "16px", background: "rgba(220,80,40,0.08)", border: "1px solid var(--error)", borderRadius: 8, fontSize: 12, color: "var(--error)" }}>
            {error}
          </div>
        )}

        {result && !loading && (
          <>
            {result.insight && (
              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text)", marginBottom: 12, padding: "12px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, whiteSpace: "pre-wrap" }}>
                {result.insight}
              </div>
            )}

            {result.espresso && <RecipePreviewCard recipe={result.espresso} selected={pick.espresso} onToggle={() => setPick((p) => ({ ...p, espresso: !p.espresso }))} />}
            {result.flatWhite && <RecipePreviewCard recipe={result.flatWhite} selected={pick.flatWhite} onToggle={() => setPick((p) => ({ ...p, flatWhite: !p.flatWhite }))} />}

            {Array.isArray(result.sources) && result.sources.length > 0 && (
              <div style={{ marginTop: 6, marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)", marginBottom: 4 }}>Sources</div>
                {result.sources.slice(0, 6).map((s, i) => (
                  <div key={i} style={{ fontSize: 11, marginBottom: 2 }}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ice)" }}>{s.title || s.url}</a>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "10px 0", background: "none", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--muted)" }}>Discard</button>
              <button onClick={save} disabled={!pick.espresso && !pick.flatWhite} style={{ flex: 2, padding: "10px 0", background: "var(--accent-dark)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, opacity: (!pick.espresso && !pick.flatWhite) ? 0.5 : 1 }}>
                Save {pick.espresso && pick.flatWhite ? "both recipes" : "recipe"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

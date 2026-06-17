import { useState, useEffect, useRef } from "react";
import { getSupabase } from "../lib/supabase";
import { newRecipeId } from "../lib/recipes";

// "1:2.5" -> 2.5 (output-per-input factor). Tolerates comma decimals, a "g"
// suffix, and an output range ("1:2.5–3" -> average of 2.5 and 3).
function parseRatioFactor(ratio) {
  const s = String(ratio || "").replace(/,/g, ".").replace(/g/gi, "");
  const m = /(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?/.exec(s);
  if (!m) return null;
  const inp = parseFloat(m[1]);
  const out = m[3] ? (parseFloat(m[2]) + parseFloat(m[3])) / 2 : parseFloat(m[2]);
  return inp ? out / inp : null;
}

// "94–96°C" -> { temp: "94–96", unit: "C" }. Only treats an F adjacent to a
// digit or degree sign as Fahrenheit (so prose like "off boil" stays Celsius).
function parseTemp(temp) {
  if (!temp) return { temp: "", unit: "C" };
  const unit = /(\d|°)\s*f/i.test(temp) ? "F" : "C";
  const t = (temp.match(/\d+(?:\.\d+)?(?:\s*[–-]\s*\d+(?:\.\d+)?)?/) || [""])[0].replace(/\s/g, "");
  return { temp: t, unit };
}

// Turn a guidance drink into a saveable recipe. Grind is left blank (the user
// dials the actual number using the direction hint, which goes in the notes).
function drinkToRecipe(drink, dose) {
  const factor = parseRatioFactor(drink.ratio);
  const { temp, unit } = parseTemp(drink.temp);
  const notes = [
    drink.grindDirection ? `${drink.grindDirection} grind` : null,
    drink.ratio || null,
    drink.note || null,
  ].filter(Boolean).join(" · ");
  return {
    name: drink.name || "Recipe",
    dose: String(dose),
    yield: factor ? String(Math.round(dose * factor)) : "",
    preInfuse: "", brewTime: "", totalTime: "",
    grind: "", feedSpeed: "",
    temp, tempUnit: unit,
    notes,
  };
}

function DrinkCard({ drink, dose, selected, onToggle }) {
  const factor = parseRatioFactor(drink.ratio);
  const yieldG = factor ? Math.round(dose * factor) : null;
  return (
    <div
      onClick={onToggle}
      style={{
        padding: "12px 14px", marginBottom: 10,
        background: "linear-gradient(135deg, #FDF8F4 0%, #FAF0E6 100%)",
        border: `2px solid ${selected ? "var(--accent-dark)" : "var(--accent-light, #E8D5C4)"}`,
        borderRadius: 10, cursor: "pointer", opacity: selected ? 1 : 0.55,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-dark)" }}>
          {selected ? "☑" : "☐"} {drink.name}
        </span>
        {drink.grindDirection && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", background: "var(--accent-dark)", borderRadius: 5 }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Grind</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "capitalize" }}>{drink.grindDirection}</span>
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, fontFamily: "'DM Mono', monospace", color: "var(--text)" }}>
        {drink.ratio && (
          <span><strong>{drink.ratio}</strong>{yieldG ? ` · ${dose}g→${yieldG}g` : ""}</span>
        )}
        {drink.temp && <span style={{ color: "var(--muted)" }}>{drink.temp}</span>}
      </div>
      {drink.note && (
        <div style={{ marginTop: 8, fontSize: 11.5, fontStyle: "italic", color: "var(--muted)" }}>{drink.note}</div>
      )}
    </div>
  );
}

export function DialInModal({ coffee, onApply, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [picks, setPicks] = useState([]);
  const started = useRef(false);

  const dose = coffee.doseG || 18;
  const drinks = result?.drinks || [];

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
            variety: coffee.variety, process: coffee.process,
            country: coffee.country, region: coffee.region,
            altitude: coffee.altitude, altitudeCategory: coffee.altitudeCategory,
            roastLevel: coffee.roastLevel, tastingNotes: coffee.tastingNotes,
            doseG: coffee.doseG,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Dial-in failed."); setLoading(false); return; }
        setResult(data);
        setPicks((data.drinks || []).map(() => true));
      } catch (err) {
        setError("Dial-in failed. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [coffee]);

  const anyPicked = picks.some(Boolean);

  const save = () => {
    const chosen = drinks
      .filter((_, i) => picks[i])
      .map((d) => ({ ...drinkToRecipe(d, dose), id: newRecipeId() }));
    if (chosen.length === 0) { onClose(); return; }
    // Parent merges against its current recipes; this modal's coffee is a snapshot.
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
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Working out a recipe…</div>
            <div style={{ fontSize: 11 }}>Based on the variety &amp; process. A few seconds.</div>
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
              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--text)", marginBottom: 12, padding: "12px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}>
                {result.insight}
              </div>
            )}

            {drinks.map((d, i) => (
              <DrinkCard
                key={i}
                drink={d}
                dose={dose}
                selected={!!picks[i]}
                onToggle={() => setPicks((p) => p.map((v, j) => (j === i ? !v : v)))}
              />
            ))}

            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12 }}>
              Saving sets the ratio (dose→yield) and notes the grind direction; dial the exact grind, then fill it in.
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "10px 0", background: "none", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--muted)" }}>Discard</button>
              <button onClick={save} disabled={!anyPicked} style={{ flex: 2, padding: "10px 0", background: "var(--accent-dark)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, opacity: anyPicked ? 1 : 0.5 }}>
                Save {picks.filter(Boolean).length > 1 ? "recipes" : "recipe"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

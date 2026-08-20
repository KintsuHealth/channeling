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

// "25–35s" -> "25–35" (drop unit words, keep a single value or a range).
function cleanSeconds(t) {
  const nums = (String(t || "").match(/\d+(?:\.\d+)?/g) || []);
  if (nums.length === 0) return "";
  return nums.length === 1 ? nums[0] : `${nums[0]}–${nums[nums.length - 1]}`;
}

// Sum two (possibly-range) second strings into a total, e.g. "25–35" + "12–20" -> "37–55".
function sumSeconds(a, b) {
  const na = (String(a).match(/\d+(?:\.\d+)?/g) || []).map(Number);
  const nb = (String(b).match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (!na.length || !nb.length) return "";
  const lo = na[0] + nb[0];
  const hi = na[na.length - 1] + nb[nb.length - 1];
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

// Turn a guidance drink into a saveable recipe. Grind is left blank (the user
// dials the actual number using the direction hint, which goes in the notes);
// the machine's pre-brew / full-throttle times map to preInfuse / brewTime.
function drinkToRecipe(drink, dose, currentSetup) {
  const factor = parseRatioFactor(drink.ratio);
  const { temp, unit } = parseTemp(drink.temp);
  const preInfuse = cleanSeconds(drink.preBrew);
  const brewTime = cleanSeconds(drink.fullThrottle);
  const notes = [
    drink.grindDirection ? `${drink.grindDirection} grind` : null,
    drink.ratio || null,
    drink.note || null,
  ].filter(Boolean).join(" · ");
  return {
    name: drink.name || "Recipe",
    method: "espresso",
    machineId: currentSetup?.machineId || "",
    basketId: currentSetup?.basketId || "",
    dose: String(dose),
    yield: factor ? String(Math.round(dose * factor)) : "",
    preInfuse, brewTime, totalTime: sumSeconds(preInfuse, brewTime),
    grind: "", feedSpeed: "",
    temp, tempUnit: unit,
    notes,
  };
}

// Pour-over guidance → saveable recipe. Bloom like "45g · 35s" splits into
// bloomG/bloomTime; pours ("2 × 130g") and drawdown target land verbatim.
function pourDrinkToRecipe(drink, brewer) {
  const { temp, unit } = parseTemp(drink.temp);
  const doseG = parseFloat(drink.doseG) || "";
  const bloomNums = (String(drink.bloom || "").match(/\d+(?:\.\d+)?/g) || []);
  const notes = [
    drink.grindDirection ? `${drink.grindDirection} grind` : null,
    drink.pours ? `pours: ${drink.pours}` : null,
    drink.note || null,
  ].filter(Boolean).join(" · ");
  const poursCount = (String(drink.pours || "").match(/^\s*(\d+)/) || [])[1] || "";
  return {
    name: drink.name || "Pour-Over",
    method: "pourover",
    brewer: brewer || "origami",
    dose: doseG ? String(doseG) : "",
    waterG: drink.waterG ? String(parseFloat(drink.waterG) || drink.waterG) : "",
    bloomG: bloomNums[0] || "",
    bloomTime: bloomNums[1] || "",
    pours: poursCount,
    totalTime: drink.totalTime || "",
    grind: "", yield: "", preInfuse: "", brewTime: "", feedSpeed: "",
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
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13, fontFamily: "'Noto Sans Mono', monospace", color: "var(--text)" }}>
        {drink.ratio && (
          <span><strong>{drink.ratio}</strong>{drink.waterG ? ` · ${drink.doseG || dose}g→${drink.waterG}g` : yieldG ? ` · ${dose}g→${yieldG}g` : ""}</span>
        )}
        {drink.temp && <span style={{ color: "var(--muted)" }}>{drink.temp}</span>}
      </div>
      {(drink.preBrew || drink.fullThrottle) && (
        <div style={{ marginTop: 5, fontSize: 12, fontFamily: "'Noto Sans Mono', monospace", color: "var(--accent-dark)" }}>
          {drink.preBrew && <span>pre-brew {drink.preBrew}</span>}
          {drink.preBrew && drink.fullThrottle && <span style={{ color: "var(--muted)" }}> → </span>}
          {drink.fullThrottle && <span>full throttle {drink.fullThrottle}</span>}
        </div>
      )}
      {(drink.bloom || drink.pours || drink.totalTime) && (
        <div style={{ marginTop: 5, fontSize: 12, fontFamily: "'Noto Sans Mono', monospace", color: "var(--accent-dark)", display: "flex", gap: 10, flexWrap: "wrap" }}>
          {drink.bloom && <span>bloom {drink.bloom}</span>}
          {drink.pours && <span>{drink.pours}</span>}
          {drink.totalTime && <span style={{ color: "var(--muted)" }}>{drink.totalTime}</span>}
        </div>
      )}
      {drink.note && (
        <div style={{ marginTop: 8, fontSize: 11.5, fontStyle: "italic", color: "var(--muted)" }}>{drink.note}</div>
      )}
    </div>
  );
}

const BREWER_OPTIONS = [
  { id: "origami", label: "Origami" },
  { id: "v60", label: "V60" },
  { id: "kalita", label: "Kalita" },
  { id: "chemex", label: "Chemex" },
];

export function DialInModal({ coffee, onApply, onClose, method = "espresso", currentSetup }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [picks, setPicks] = useState([]);
  const [brewer, setBrewer] = useState("origami");
  const fetchSeq = useRef(0);
  const started = useRef(false);

  const dose = coffee.doseG || 18;
  const drinks = result?.drinks || [];
  const isPourover = method === "pourover";

  const fetchGuidance = async (brewerId) => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    setResult(null);
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
          method,
          machineId: currentSetup?.machineId,
          brewer: brewerId,
        }),
      });
      const data = await res.json();
      if (seq !== fetchSeq.current) return; // superseded by a newer request
      if (!res.ok) { setError(data.error || "Dial-in failed."); setLoading(false); return; }
      setResult(data);
      setPicks((data.drinks || []).map(() => true));
    } catch (err) {
      if (seq === fetchSeq.current) setError("Dial-in failed. Please try again.");
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (started.current) return; // guard the paid call against strict-mode double-mount
    started.current = true;
    fetchGuidance(brewer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anyPicked = picks.some(Boolean);

  const save = () => {
    const chosen = drinks
      .filter((_, i) => picks[i])
      .map((d) => ({
        ...(isPourover ? pourDrinkToRecipe(d, brewer) : drinkToRecipe(d, dose, currentSetup)),
        id: newRecipeId(),
      }));
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
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-dark)" }}>
            ✦ {isPourover ? "Pour-Over Dial-In" : "AI Dial-In"} · {coffee.name || "Coffee"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "var(--muted)", cursor: "pointer" }}>×</button>
        </div>

        {isPourover && (
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {BREWER_OPTIONS.map((b) => (
              <button
                key={b.id}
                onClick={() => { if (b.id !== brewer) { setBrewer(b.id); fetchGuidance(b.id); } }}
                disabled={loading}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: brewer === b.id ? "var(--accent-dark)" : "var(--card)",
                  color: brewer === b.id ? "#fff" : "var(--muted)",
                  border: `1.5px solid ${brewer === b.id ? "var(--accent-dark)" : "var(--border)"}`,
                  opacity: loading && brewer !== b.id ? 0.5 : 1,
                }}
              >{b.label}</button>
            ))}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)" }}>
            <div style={{ width: 26, height: 26, margin: "0 auto 12px", border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
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
              {isPourover
                ? "Saving sets dose, water, bloom and pour structure, and notes the grind direction; dial the exact grind, then fill it in."
                : "Saving sets the ratio (dose→yield), pre-brew & full-throttle times, and notes the grind direction; dial the exact grind, then fill it in."}
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

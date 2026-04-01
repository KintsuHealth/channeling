import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import Head from "next/head";
import { useCoffees } from "@/lib/useCoffees";
import { useSettings } from "@/lib/useSettings";
import { useAuth } from "@/lib/useAuth";
import { DataMigration } from "@/components/DataMigration";
import { optimizePortions, parseGrams, DEFAULT_DOSE_G, DEFAULT_DOSES_PER_PORTION } from "@/lib/portions";
import { useStats } from "@/lib/useStats";
import Overview from "@/components/Overview";
import { EditCoffeeModal } from "@/components/EditCoffeeModal";
import { CoffeeDetailModal } from "@/components/CoffeeDetailModal";
import { DuplicateDetectionModal } from "@/components/DuplicateDetectionModal";
import { getRoastQuarter } from "@/lib/roastBatch";
import { findDuplicateCoffee, mergePortions } from "@/lib/duplicateDetection";
import {
  calculateGrindOffset,
  formatOffset,
  calculateSuggestedGrind,
  findPreviousGrindSettings,
  validatePrediction,
  parseAltitude
} from "@/lib/grindPredictor";
import { calculateDegasDays, getDegasSuggestion, getFreezeDate } from "@/lib/degasPredictor";

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const fmtFull = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const daysAgo = (iso) => {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
};

function Badge({ children, bg }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", background: bg || "var(--tag)", color: "var(--accent-dark)", marginRight: 5 }}>
      {children}
    </span>
  );
}

function LabelThumbnail({ src, size = 48, expandable = true }) {
  const [expanded, setExpanded] = useState(false);
  if (!src) return null;
  return (
    <>
      <div
        onClick={expandable ? (e) => { e.stopPropagation(); setExpanded(true); } : undefined}
        style={{
          width: size, height: size, borderRadius: 6, overflow: "hidden",
          border: "1.5px solid var(--border)", cursor: expandable ? "pointer" : "default",
          flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}
      >
        <img src={src} alt="Coffee label" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      {expanded && (
        <div
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 20, cursor: "pointer",
          }}
        >
          <img src={src} alt="Coffee label" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8, objectFit: "contain" }} />
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
            style={{
              position: "absolute", top: 20, right: 20, width: 40, height: 40,
              background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%",
              color: "#fff", fontSize: 20, cursor: "pointer",
            }}
          >✕</button>
        </div>
      )}
    </>
  );
}

// Country code mapping
const COUNTRY_CODES = {
  "colombia": "COL", "brazil": "BRA", "ethiopia": "ETH", "kenya": "KEN", "guatemala": "GUA",
  "costa rica": "CRI", "panama": "PAN", "honduras": "HON", "el salvador": "SLV", "peru": "PER",
  "mexico": "MEX", "nicaragua": "NIC", "rwanda": "RWA", "burundi": "BDI", "indonesia": "IDN",
  "vietnam": "VNM", "india": "IND", "yemen": "YEM", "jamaica": "JAM", "hawaii": "HAW",
  "ecuador": "ECU", "bolivia": "BOL", "tanzania": "TZA", "uganda": "UGA", "congo": "COD",
  "malawi": "MWI", "zambia": "ZMB", "papua new guinea": "PNG", "china": "CHN", "thailand": "THA",
};
const getCountryCode = (country) => {
  if (!country) return null;
  const lower = country.toLowerCase();
  return COUNTRY_CODES[lower] || country.slice(0, 3).toUpperCase();
};

// Clean digital label card using bag colors
function LabelCard({ coffee, size = "medium" }) {
  const bgColor = coffee.bagColor || "#6B4423";

  // Calculate if we need light or dark text
  const isDark = (hex) => {
    if (!hex || !hex.startsWith("#")) return true;
    const c = hex.replace("#", "");
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 140;
  };

  const dark = isDark(bgColor);
  const primary = coffee.textColor || (dark ? "#FFFFFF" : "#1A1A1A");
  const secondary = dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)";

  // Increased sizes for better readability
  const sizes = {
    small: { width: 90, height: 110, nameSize: 11, tagSize: 7, roasterSize: 6, padding: 8, gap: 3 },
    medium: { width: 115, height: 135, nameSize: 13, tagSize: 8, roasterSize: 7, padding: 10, gap: 3 },
    large: { width: 155, height: 175, nameSize: 16, tagSize: 9, roasterSize: 8, padding: 14, gap: 4 },
  };
  const s = sizes[size] || sizes.medium;

  // Build tags: country code, variety, process
  const countryCode = getCountryCode(coffee.country);
  const variety = coffee.variety || null;
  const process = coffee.process || null;
  const tags = [countryCode, variety, process].filter(Boolean);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: s.width,
        height: s.height,
        background: `linear-gradient(145deg, ${bgColor} 0%, ${bgColor}ee 100%)`,
        borderRadius: 12,
        padding: s.padding,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 4px 14px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.12)",
        border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top: Roaster */}
      {coffee.roaster && (
        <div style={{
          fontSize: s.roasterSize,
          fontWeight: 600,
          color: secondary,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          lineHeight: 1.1,
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {coffee.roaster.length > 14 ? coffee.roaster.slice(0, 13) + "…" : coffee.roaster}
        </div>
      )}

      {/* Middle: Coffee name - allow full display */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 0",
      }}>
        <div style={{
          fontSize: s.nameSize,
          fontWeight: 700,
          color: primary,
          lineHeight: 1.2,
          fontFamily: "'Playfair Display', Georgia, serif",
          textAlign: "center",
          wordBreak: "break-word",
          hyphens: "auto",
        }}>
          {coffee.name || "Unnamed"}
        </div>
      </div>

      {/* Bottom: Tags stacked vertically */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: s.gap,
        alignItems: "center",
      }}>
        {tags.map((tag, i) => (
          <span
            key={i}
            style={{
              fontSize: s.tagSize,
              fontWeight: 500,
              color: primary,
              background: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
              padding: "2px 8px",
              borderRadius: 4,
              textTransform: "uppercase",
              letterSpacing: "0.3px",
              whiteSpace: "nowrap",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stars({ value, onChange, size = 16 }) {
  const [h, setH] = useState(null);
  const d = h ?? value;
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} onMouseEnter={() => onChange && setH(s)} onMouseLeave={() => setH(null)}
          onClick={(e) => { e.stopPropagation(); onChange?.(s === value ? 0 : s); }}
          style={{ cursor: onChange ? "pointer" : "default", fontSize: size, lineHeight: 1, color: s <= d ? "var(--star)" : "var(--star-off)", transition: "color 0.15s" }}>
          ●
        </span>
      ))}
    </div>
  );
}

function PortionPlanPreview({ plan, wholeBag }) {
  if (!plan?.portions?.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--ice)", marginBottom: 8 }}>
        {wholeBag ? "Whole Bag" : "Portion Plan"}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
        {plan.portions.map((p, i) => (
          <div key={i} style={{ padding: "8px 10px", background: "var(--ice-bg)", border: "1px solid var(--ice)", borderRadius: 8, textAlign: "center", minWidth: 68 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ice)" }}>{p.grams}g</div>
            <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.4 }}>
              {p.doses} dose{p.doses !== 1 ? "s" : ""}
              {p.buffer > 0 && <><br /><span style={{ color: "var(--buffer)" }}>+{p.buffer}g</span></>}
            </div>
          </div>
        ))}
      </div>
      {plan.summary && <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 500 }}>{plan.summary}</div>}
    </div>
  );
}

function DoseTracker({ portion, dosesUsed, onChange, doseG = DEFAULT_DOSE_G }) {
  if (!portion) return null;
  const total = portion.doses;
  const left = total - dosesUsed;
  const gramsLeft = left * doseG + (left > 0 ? portion.buffer : 0);
  return (
    <div style={{ marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--active)" }}>Doses</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{dosesUsed}/{total} · ~{gramsLeft}g left</span>
      </div>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} onClick={() => onChange(i < dosesUsed ? i : i + 1)} style={{
            width: 28, height: 28, borderRadius: 6, background: i < dosesUsed ? "var(--active)" : "#EDE8E2",
            border: `1.5px solid ${i < dosesUsed ? "#D06830" : "var(--border)"}`, cursor: "pointer", transition: "all 0.15s",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700,
            color: i < dosesUsed ? "#fff" : "var(--muted)",
          }}>{i + 1}</div>
        ))}
        {portion.buffer > 0 && (
          <div style={{ height: 28, padding: "0 8px", borderRadius: 6, display: "flex", alignItems: "center", background: "var(--buffer-bg)", border: "1px solid var(--buffer)", fontSize: 9, fontWeight: 600, color: "var(--buffer)" }}>+{portion.buffer}g</div>
        )}
      </div>
      <div style={{ marginTop: 5, height: 4, background: "#EDE8E2", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${total > 0 ? Math.round((dosesUsed / total) * 100) : 0}%`, background: "var(--active)", borderRadius: 2, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function AltitudeSelector({ value, onChange }) {
  const options = [
    { key: "high", label: "High", desc: "1800m+" },
    { key: "mid", label: "Mid", desc: "1400-1800m" },
    { key: "low", label: "Low", desc: "<1400m" },
    { key: null, label: "Unknown", desc: "" },
  ];
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map((o) => (
        <button key={o.key || "null"} type="button" onClick={() => onChange(o.key)} style={{
          flex: 1, padding: "6px 4px", border: `1.5px solid ${value === o.key ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 6, background: value === o.key ? "var(--accent-light)" : "#fff",
          color: value === o.key ? "var(--accent-dark)" : "var(--muted)", fontSize: 10, fontWeight: 600,
          cursor: "pointer", transition: "all 0.15s", textAlign: "center",
        }}>
          <div>{o.label}</div>
          {o.desc && <div style={{ fontSize: 8, opacity: 0.7, marginTop: 1 }}>{o.desc}</div>}
        </button>
      ))}
    </div>
  );
}

function GrindPredictionCard({ coffee, baseline, allCoffees, compact = false }) {
  const prediction = useMemo(() => calculateGrindOffset(coffee, coffee?.pulledAt), [coffee]);
  const suggested = baseline !== null ? calculateSuggestedGrind(baseline, prediction.offset) : null;
  const previous = useMemo(() => findPreviousGrindSettings(coffee, allCoffees || []), [coffee, allCoffees]);

  if (!prediction || prediction.rationale.length === 0) return null;

  const confColors = { high: "var(--success)", medium: "var(--active)", low: "var(--muted)" };

  return (
    <div style={{ padding: compact ? "10px 12px" : "12px 14px", background: "#F8F5F2", borderRadius: 8, border: "1px solid var(--border)", marginTop: compact ? 8 : 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)" }}>Grind Prediction</div>
        <div style={{ fontSize: 9, fontWeight: 600, color: confColors[prediction.confidence], textTransform: "uppercase" }}>{prediction.confidence} conf</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>{formatOffset(prediction.offset)}</div>
      {suggested !== null && (
        <div style={{ fontSize: 13, color: "var(--accent-dark)", fontWeight: 600, marginBottom: 6 }}>
          Suggested starting grind: <span style={{ fontFamily: "'DM Mono', monospace" }}>{suggested}</span>
        </div>
      )}
      {previous && (
        <div style={{ fontSize: 11, color: "var(--ice)", fontWeight: 500, marginBottom: 6 }}>
          You dialed this in at <span style={{ fontWeight: 700 }}>{previous.grind}</span> last time
        </div>
      )}
      {!compact && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {prediction.rationale.map((r, i) => (
            <span key={i} style={{ fontSize: 9, padding: "3px 7px", background: "#EDE8E2", borderRadius: 4, color: "var(--muted)" }}>{r}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function PredictionValidationBadge({ predicted, actual }) {
  const validation = validatePrediction(predicted, actual);
  if (!validation) return null;

  const colors = {
    close: { bg: "#E8F5E9", border: "var(--success)", text: "var(--success)" },
    off: { bg: "#FFF8E1", border: "var(--active)", text: "var(--active)" },
    way_off: { bg: "#FBE9E7", border: "var(--error)", text: "var(--error)" },
  };
  const c = colors[validation.status];

  return (
    <div style={{ padding: "6px 10px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6, fontSize: 11, color: c.text, fontWeight: 500, marginTop: 8 }}>
      {validation.status === "close" && "✓ "}{validation.message}
    </div>
  );
}

function EspressoRecipe({ recipe, onChange, coffee, baseline, allCoffees }) {
  const [editing, setEditing] = useState(false);
  const [tempUnit, setTempUnit] = useState("C");
  const [loc, setLoc] = useState(recipe || { dose: "", yield: "", preInfuse: "", brewTime: "", totalTime: "", grind: "", feedSpeed: "", temp: "", notes: "" });
  const save = () => { onChange({ ...loc, tempUnit }); setEditing(false); };
  const has = recipe && (recipe.dose || recipe.yield || recipe.totalTime || recipe.grind);

  const inputStyle = { width: "100%", padding: "5px 6px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, background: "#fff", color: "var(--text)", fontFamily: "'DM Mono', monospace" };
  const labelStyle = { fontSize: 9, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 2 };
  const sectionStyle = { marginBottom: 10, padding: "8px", background: "#fff", borderRadius: 6, border: "1px solid var(--border)" };
  const sectionTitleStyle = { fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", marginBottom: 6 };

  // Calculate predicted grind
  const prediction = useMemo(() => coffee ? calculateGrindOffset(coffee, coffee.pulledAt) : null, [coffee]);
  const suggestedGrind = baseline !== null && prediction ? calculateSuggestedGrind(baseline, prediction.offset) : null;

  if (!editing && !has) return (
    <div>
      {coffee && prediction?.rationale?.length > 0 && (
        <GrindPredictionCard coffee={coffee} baseline={baseline} allCoffees={allCoffees} compact />
      )}
      <button onClick={(e) => { e.stopPropagation(); setEditing(true); }} style={{ marginTop: 8, padding: "6px 12px", background: "none", border: "1px dashed var(--border)", borderRadius: 6, fontSize: 11, color: "var(--muted)", width: "100%", textAlign: "left" }}>+ Espresso recipe</button>
    </div>
  );

  if (editing) return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10, padding: 12, background: "#FAF7F4", borderRadius: 8, border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", marginBottom: 10 }}>Espresso Recipe</div>
      {coffee && prediction?.rationale?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <GrindPredictionCard coffee={coffee} baseline={baseline} allCoffees={allCoffees} compact />
        </div>
      )}

      {/* Dose & Yield */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div>
          <label style={labelStyle}>Dose (g)</label>
          <input value={loc.dose || ""} onChange={(e) => setLoc({ ...loc, dose: e.target.value })} placeholder="18" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Yield (g)</label>
          <input value={loc.yield || ""} onChange={(e) => setLoc({ ...loc, yield: e.target.value })} placeholder="36" style={inputStyle} />
        </div>
      </div>

      {/* Time Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Time</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <div>
            <label style={labelStyle}>Pre-infusion (s)</label>
            <input value={loc.preInfuse || ""} onChange={(e) => {
              const preInfuse = e.target.value;
              const total = (parseFloat(preInfuse) || 0) + (parseFloat(loc.brewTime) || 0);
              setLoc({ ...loc, preInfuse, totalTime: total > 0 ? String(total) : "" });
            }} placeholder="5" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Brew (s)</label>
            <input value={loc.brewTime || ""} onChange={(e) => {
              const brewTime = e.target.value;
              const total = (parseFloat(loc.preInfuse) || 0) + (parseFloat(brewTime) || 0);
              setLoc({ ...loc, brewTime, totalTime: total > 0 ? String(total) : "" });
            }} placeholder="23" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Total (s)</label>
            <div style={{ ...inputStyle, background: "#F5F2EF", color: "var(--accent-dark)", fontWeight: 600, display: "flex", alignItems: "center" }}>
              {loc.totalTime || "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Grinder Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Grinder</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <div>
            <label style={labelStyle}>Grind Setting</label>
            <input value={loc.grind || ""} onChange={(e) => setLoc({ ...loc, grind: e.target.value })} placeholder="2.5" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Feed Speed</label>
            <select value={loc.feedSpeed || ""} onChange={(e) => setLoc({ ...loc, feedSpeed: e.target.value })} style={{ ...inputStyle, fontFamily: "inherit" }}>
              <option value="">Select...</option>
              <option value="slow">Slow</option>
              <option value="medium">Medium</option>
              <option value="fast">Fast</option>
              <option value="auto">Auto</option>
            </select>
          </div>
        </div>
      </div>

      {/* Temperature Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Temp</div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Temp</label>
            <input value={loc.temp || ""} onChange={(e) => setLoc({ ...loc, temp: e.target.value })} placeholder={tempUnit === "C" ? "93" : "200"} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            <button type="button" onClick={() => setTempUnit("C")} style={{ padding: "5px 10px", background: tempUnit === "C" ? "var(--accent-dark)" : "#fff", color: tempUnit === "C" ? "#fff" : "var(--muted)", border: "1px solid var(--border)", borderRadius: "4px 0 0 4px", fontSize: 11, fontWeight: 600 }}>°C</button>
            <button type="button" onClick={() => setTempUnit("F")} style={{ padding: "5px 10px", background: tempUnit === "F" ? "var(--accent-dark)" : "#fff", color: tempUnit === "F" ? "#fff" : "var(--muted)", border: "1px solid var(--border)", borderRadius: "0 4px 4px 0", fontSize: 11, fontWeight: 600 }}>°F</button>
          </div>
        </div>
      </div>

      {/* Notes */}
      <textarea value={loc.notes || ""} onChange={(e) => setLoc({ ...loc, notes: e.target.value })} placeholder="Channeling, taste, pressure notes…" rows={2}
        style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 11, resize: "vertical", background: "#fff", color: "var(--text)" }} />

      <div style={{ display: "flex", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
        <button onClick={() => setEditing(false)} style={{ padding: "6px 14px", background: "none", border: "1px solid var(--border)", borderRadius: 5, fontSize: 11, color: "var(--muted)" }}>Cancel</button>
        <button onClick={save} style={{ padding: "6px 14px", background: "var(--accent-dark)", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 600 }}>Save Recipe</button>
      </div>
    </div>
  );

  // Display existing recipe - make it prominent with grind as hero
  return (
    <div onClick={(e) => { e.stopPropagation(); setEditing(true); }} style={{ marginTop: 12, padding: 14, background: "linear-gradient(135deg, #FDF8F4 0%, #FAF0E6 100%)", borderRadius: 10, border: "2px solid var(--accent-light, #E8D5C4)", cursor: "pointer", boxShadow: "0 2px 8px rgba(92,45,14,0.08)" }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", marginBottom: 10 }}>● Dialed Recipe — tap to edit</div>

      {/* Grind Setting - Hero Element */}
      {(recipe.grind || recipe.feedSpeed) && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, padding: "10px 12px", background: "var(--accent-dark)", borderRadius: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Grind</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "#fff", letterSpacing: "-1px" }}>
            {recipe.grind || "—"}
          </div>
          {recipe.feedSpeed && (
            <div style={{ marginLeft: "auto", padding: "4px 10px", background: "rgba(255,255,255,0.2)", borderRadius: 4, fontSize: 11, fontWeight: 600, color: "#fff", textTransform: "capitalize" }}>
              {recipe.feedSpeed}
            </div>
          )}
        </div>
      )}

      {/* Recipe Details Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
        {/* Dose/Yield */}
        {(recipe.dose || recipe.yield) && (
          <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.6)", borderRadius: 6, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Ratio</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "var(--text)" }}>
              {recipe.dose || "—"}g → {recipe.yield || "—"}g
            </div>
          </div>
        )}

        {/* Time */}
        {recipe.totalTime && (
          <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.6)", borderRadius: 6, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Time</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "var(--text)" }}>
              {recipe.totalTime}s
            </div>
            {(recipe.preInfuse || recipe.brewTime) && (
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                {recipe.preInfuse && <span>Pre: {recipe.preInfuse}s</span>}
                {recipe.preInfuse && recipe.brewTime && <span> · </span>}
                {recipe.brewTime && <span>Brew: {recipe.brewTime}s</span>}
              </div>
            )}
          </div>
        )}

        {/* Temperature */}
        {recipe.temp && (
          <div style={{ padding: "8px 10px", background: "rgba(255,255,255,0.6)", borderRadius: 6, border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>Temp</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: "var(--text)" }}>
              {recipe.temp}°{recipe.tempUnit || "C"}
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {recipe.notes && (
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", fontStyle: "italic", padding: "8px 10px", background: "rgba(255,255,255,0.4)", borderRadius: 6 }}>
          "{recipe.notes}"
        </div>
      )}
    </div>
  );
}

// Compress image to stay under 5MB API limit
const compressImage = (file, maxSizeBytes = 4 * 1024 * 1024) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down large images
      const maxDim = 1600;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Try progressively lower quality until under size limit
      const tryCompress = (q) => {
        canvas.toBlob((blob) => {
          if (blob.size > maxSizeBytes && q > 0.3) {
            tryCompress(q - 0.1);
          } else {
            resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
          }
        }, "image/jpeg", q);
      };
      tryCompress(0.85);
    };
    img.src = URL.createObjectURL(file);
  });
};


const EMPTY = { name: "", country: "", region: "", variety: "", producer: "", roaster: "", roastLevel: "", process: "", altitude: "", altitudeCategory: null, weight: "", price: "", tastingNotes: "", roastDate: "" };

const FREEZER_SORT_OPTIONS = [
  { key: "longest", label: "Longest" },
  { key: "newest", label: "Newest" },
  { key: "oldest-roast", label: "Oldest roast" },
  { key: "freshest-roast", label: "Freshest" },
  { key: "almost-done", label: "Almost done" },
  { key: "most-remaining", label: "Most left" },
];

const COMMON_WEIGHTS = ["250", "300", "340", "500", "1000"];

function EditableResult({ data, onChange, onSubmit, onCancel, doseG, setDoseG, baseline, allCoffees }) {
  // Auto-derive altitudeCategory from altitude text if not already set
  const initialData = { ...EMPTY, ...data };
  if (!initialData.altitudeCategory && initialData.altitude) {
    initialData.altitudeCategory = parseAltitude(initialData.altitude);
  }
  const [f, setF] = useState(initialData);
  const [manualWeight, setManualWeight] = useState(false);
  const [wholeBag, setWholeBag] = useState(false);

  // Determine default addAs based on roastDate and smart degas calculation
  const getDefaultAddAs = () => {
    if (initialData.roastDate) {
      const suggestion = getDegasSuggestion(initialData);
      // If action is 'freeze_now', the coffee is ready to freeze
      return suggestion.action === 'freeze_now' ? 'frozen' : 'resting';
    }
    return 'frozen';
  };
  const [addAs, setAddAs] = useState(getDefaultAddAs);

  // Calculate smart degas suggestion based on current form data
  const degasPrediction = useMemo(() => calculateDegasDays(f), [f.roastLevel, f.process, f.altitudeCategory]);

  // Resting duration (editable, initialized with smart suggestion)
  const [restingDays, setRestingDays] = useState(() => calculateDegasDays(initialData).days);

  // Update restingDays when prediction changes (user edited roast/process/altitude)
  const [lastSuggestion, setLastSuggestion] = useState(degasPrediction.days);
  useEffect(() => {
    if (degasPrediction.days !== lastSuggestion) {
      setRestingDays(degasPrediction.days);
      setLastSuggestion(degasPrediction.days);
    }
  }, [degasPrediction.days, lastSuggestion]);

  // Doses per portion selector
  const [dosesPerPortion, setDosesPerPortion] = useState(DEFAULT_DOSES_PER_PORTION);
  const [customDoses, setCustomDoses] = useState(false);

  // AI suggestion state
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [suggestError, setSuggestError] = useState(null);
  const needsSuggestions = !f.region || !f.altitude;

  const fetchSuggestions = async () => {
    setSuggesting(true);
    setSuggestError(null);
    setSuggestions(null);
    try {
      const res = await fetch("/api/suggest-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      if (!res.ok) throw new Error("Failed to get suggestions");
      const data = await res.json();
      if (data.suggestions && Object.keys(data.suggestions).length > 0) {
        const validSuggestions = {};
        for (const [key, value] of Object.entries(data.suggestions)) {
          if (value !== null) validSuggestions[key] = value;
        }
        if (Object.keys(validSuggestions).length > 0) {
          setSuggestions({ ...data, suggestions: validSuggestions });
        } else {
          setSuggestError("Could not determine suggestions with available data");
        }
      } else {
        setSuggestError(data.notes || "No suggestions available");
      }
    } catch (err) {
      setSuggestError(err.message);
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestions = () => {
    if (!suggestions?.suggestions) return;
    const updated = { ...f, ...suggestions.suggestions };
    // Auto-derive altitude category if altitude was suggested
    if (suggestions.suggestions.altitude && !updated.altitudeCategory) {
      updated.altitudeCategory = parseAltitude(suggestions.suggestions.altitude);
    }
    setF(updated);
    onChange(updated);
    setSuggestions(null);
  };

  // Duplicate detection
  const [duplicateMatch, setDuplicateMatch] = useState(null);
  useEffect(() => {
    if (f.name && allCoffees?.length) {
      const result = findDuplicateCoffee(f, allCoffees);
      setDuplicateMatch(result);
    } else {
      setDuplicateMatch(null);
    }
  }, [f.name, f.roaster, allCoffees]);

  const set = (k, v) => {
    const updated = { ...f, [k]: v };
    setF(updated);
    onChange(updated);
  };
  const grams = parseGrams(f.weight);
  const plan = wholeBag
    ? { portions: [{ grams, doses: Math.floor(grams / doseG), buffer: grams % doseG }], summary: `1 whole bag · ${Math.floor(grams / doseG)} doses` }
    : optimizePortions(grams, doseG, dosesPerPortion);

  // Check if scanned weight matches a common weight
  const scannedGrams = parseGrams(data.weight);
  const isCommonWeight = scannedGrams && COMMON_WEIGHTS.includes(String(scannedGrams));
  const showManual = manualWeight || (!isCommonWeight && !COMMON_WEIGHTS.includes(String(grams)));

  const fields = [
    ["name", "Coffee Name *", "full"],
    ["roaster", "Roaster"],
    ["country", "Country"],
    ["region", "Region"],
    ["variety", "Variety"],
    ["producer", "Producer"],
    ["roastLevel", "Roast Level"],
    ["process", "Process"],
    ["altitude", "Altitude"],
    ["price", "Price"],
    ["roastDate", "Roast Date", null, "YYYY-MM-DD", "date"],
    ["tastingNotes", "Tasting Notes", "full"],
  ];

  return (
    <div style={{ padding: 18, textAlign: "left" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--success)", marginBottom: 12 }}>✓ Scanned — Edit if needed</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px" }}>
        {fields.map(([k, label, span, placeholder, type]) => (
          <div key={k} style={{ gridColumn: span === "full" ? "1 / -1" : undefined }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 2 }}>{label}</label>
            <input
              type={type || "text"}
              value={f[k] || ""}
              onChange={(e) => set(k, e.target.value)}
              placeholder={placeholder}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, background: "#fff", color: "var(--text)" }}
            />
          </div>
        ))}
        {/* Weight selector */}
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Weight *</label>
          {showManual ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                value={f.weight || ""}
                onChange={(e) => set("weight", e.target.value)}
                placeholder="e.g. 500"
                style={{ flex: 1, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, background: "#fff", color: "var(--text)" }}
              />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>g</span>
              <button
                onClick={() => { setManualWeight(false); set("weight", "250"); }}
                style={{ padding: "6px 10px", background: "none", border: "1px solid var(--border)", borderRadius: 5, fontSize: 11, color: "var(--muted)" }}
              >Presets</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {COMMON_WEIGHTS.map((w) => (
                <button
                  key={w}
                  onClick={() => set("weight", w)}
                  style={{
                    padding: "6px 12px",
                    background: String(grams) === w ? "var(--accent-dark)" : "#fff",
                    color: String(grams) === w ? "#fff" : "var(--text)",
                    border: `1px solid ${String(grams) === w ? "var(--accent-dark)" : "var(--border)"}`,
                    borderRadius: 5,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >{w}g</button>
              ))}
              <button
                onClick={() => setManualWeight(true)}
                style={{ padding: "6px 12px", background: "none", border: "1px dashed var(--border)", borderRadius: 5, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}
              >Other</button>
            </div>
          )}
        </div>
      </div>
      {/* AI Suggestions for missing fields */}
      {needsSuggestions && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--accent-light)", border: "1px solid var(--accent)", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: suggestions ? 8 : 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-dark)" }}>
              {!f.region && !f.altitude ? "Missing region & altitude" : !f.region ? "Missing region" : "Missing altitude"}
            </span>
            <button
              type="button"
              onClick={fetchSuggestions}
              disabled={suggesting}
              style={{ padding: "5px 12px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: suggesting ? "wait" : "pointer", opacity: suggesting ? 0.7 : 1 }}
            >
              {suggesting ? "Looking up..." : "✨ Suggest"}
            </button>
          </div>
          {suggestError && <div style={{ fontSize: 11, color: "var(--error)", marginTop: 6 }}>{suggestError}</div>}
          {suggestions && (
            <div style={{ marginTop: 8, padding: "8px 10px", background: "#fff", borderRadius: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--success)", marginBottom: 4 }}>
                {suggestions.confidence} confidence
              </div>
              {Object.entries(suggestions.suggestions).map(([key, value]) => (
                <div key={key} style={{ fontSize: 12, marginBottom: 2 }}>
                  <strong style={{ textTransform: "capitalize" }}>{key}:</strong> {value}
                </div>
              ))}
              {suggestions.notes && <div style={{ fontSize: 10, color: "var(--muted)", fontStyle: "italic", marginTop: 4 }}>{suggestions.notes}</div>}
              <button
                type="button"
                onClick={applySuggestions}
                style={{ marginTop: 6, padding: "5px 12px", background: "var(--success)", color: "#fff", border: "none", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
      {/* Storage method toggle */}
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Storage Method</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setWholeBag(false)}
            style={{
              flex: 1,
              padding: "10px 12px",
              background: !wholeBag ? "var(--ice)" : "#fff",
              color: !wholeBag ? "#fff" : "var(--text)",
              border: `1.5px solid ${!wholeBag ? "var(--ice)" : "var(--border)"}`,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div>Portion</div>
            <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>Split into portions</div>
          </button>
          <button
            type="button"
            onClick={() => setWholeBag(true)}
            style={{
              flex: 1,
              padding: "10px 12px",
              background: wholeBag ? "var(--ice)" : "#fff",
              color: wholeBag ? "#fff" : "var(--text)",
              border: `1.5px solid ${wholeBag ? "var(--ice)" : "var(--border)"}`,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div>Whole Bag</div>
            <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>Keep as one unit</div>
          </button>
        </div>
      </div>
      {/* Doses per portion selector - only show when portioning */}
      {!wholeBag && (
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Doses per Portion</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[3, 5, 7].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setDosesPerPortion(d); setCustomDoses(false); }}
                style={{
                  padding: "8px 16px",
                  background: dosesPerPortion === d && !customDoses ? "var(--ice)" : "#fff",
                  color: dosesPerPortion === d && !customDoses ? "#fff" : "var(--text)",
                  border: `1.5px solid ${dosesPerPortion === d && !customDoses ? "var(--ice)" : "var(--border)"}`,
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {d}
              </button>
            ))}
            {customDoses ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  value={dosesPerPortion}
                  onChange={(e) => setDosesPerPortion(Math.max(1, Math.min(20, Number(e.target.value) || 5)))}
                  min={1}
                  max={20}
                  style={{ width: 50, padding: "6px 8px", border: "1.5px solid var(--ice)", borderRadius: 6, fontSize: 13, textAlign: "center", fontWeight: 600 }}
                />
                <button
                  type="button"
                  onClick={() => { setCustomDoses(false); setDosesPerPortion(5); }}
                  style={{ padding: "6px 10px", background: "none", border: "1px solid var(--border)", borderRadius: 5, fontSize: 11, color: "var(--muted)", cursor: "pointer" }}
                >
                  Presets
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCustomDoses(true)}
                style={{ padding: "8px 12px", background: "none", border: "1px dashed var(--border)", borderRadius: 6, fontSize: 12, color: "var(--muted)", cursor: "pointer" }}
              >
                Custom
              </button>
            )}
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            {grams > 0 ? `≈ ${Math.ceil(Math.floor(grams / doseG) / dosesPerPortion)} portions` : ""}
          </div>
        </div>
      )}
      {/* Add As toggle - Resting vs Freezer */}
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 6 }}>Add As</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setAddAs('resting')}
            style={{
              flex: 1,
              padding: "10px 12px",
              background: addAs === 'resting' ? "var(--accent)" : "#fff",
              color: addAs === 'resting' ? "#fff" : "var(--text)",
              border: `1.5px solid ${addAs === 'resting' ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div>○ Resting</div>
            <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>Degas first</div>
          </button>
          <button
            type="button"
            onClick={() => setAddAs('frozen')}
            style={{
              flex: 1,
              padding: "10px 12px",
              background: addAs === 'frozen' ? "var(--ice)" : "#fff",
              color: addAs === 'frozen' ? "#fff" : "var(--text)",
              border: `1.5px solid ${addAs === 'frozen' ? "var(--ice)" : "var(--border)"}`,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div>❄ Freezer</div>
            <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>Ready to freeze</div>
          </button>
        </div>
        {/* Resting duration selector with smart suggestion - only show when resting selected */}
        {addAs === 'resting' && (
          <div style={{ marginTop: 10, padding: "12px 14px", background: "var(--accent-light)", borderRadius: 8, border: "1px solid var(--accent)" }}>
            {/* Smart suggestion header */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>💡</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-dark)" }}>
                Suggested: {degasPrediction.days} days
              </span>
              <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto", textTransform: "capitalize" }}>
                {degasPrediction.confidence} confidence
              </span>
            </div>
            {/* Rationale */}
            {degasPrediction.rationale.length > 0 && (
              <div style={{ fontSize: 10, color: "var(--accent-dark)", marginBottom: 10, lineHeight: 1.5 }}>
                {degasPrediction.rationale.map((r, i) => (
                  <div key={i}>• {r}</div>
                ))}
              </div>
            )}
            {/* Rest duration selector */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent-dark)" }}>Rest for</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {[7, degasPrediction.days, 14, 21].filter((d, i, arr) => arr.indexOf(d) === i).sort((a, b) => a - b).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setRestingDays(d); }}
                    style={{
                      padding: "6px 12px",
                      background: restingDays === d ? "var(--accent)" : "#fff",
                      color: restingDays === d ? "#fff" : "var(--accent-dark)",
                      border: `1.5px solid ${restingDays === d ? "var(--accent)" : "var(--accent)"}`,
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    {d}d{d === degasPrediction.days && restingDays === d && " ✓"}
                  </button>
                ))}
                <input
                  type="number"
                  value={restingDays}
                  onChange={(e) => setRestingDays(Math.max(1, Math.min(60, Number(e.target.value) || degasPrediction.days)))}
                  min={1}
                  max={60}
                  style={{ width: 40, padding: "4px 6px", border: "1px solid var(--accent)", borderRadius: 4, fontSize: 11, textAlign: "center", fontWeight: 600 }}
                />
                <span style={{ fontSize: 11, color: "var(--accent-dark)" }}>days</span>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Altitude selector */}
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 4 }}>Altitude Category</label>
        <AltitudeSelector value={f.altitudeCategory} onChange={(v) => set("altitudeCategory", v)} />
      </div>
      {/* Dose setting */}
      <div style={{ marginTop: 12, padding: "10px 12px", background: "#FAF7F4", borderRadius: 6, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Your dose size</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number"
              value={doseG}
              onChange={(e) => setDoseG(Number(e.target.value) || DEFAULT_DOSE_G)}
              min={10}
              max={25}
              style={{ width: 50, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13, textAlign: "center", fontWeight: 600 }}
            />
            <span style={{ fontSize: 12, color: "var(--muted)" }}>g</span>
          </div>
        </div>
      </div>
      {/* Grind Prediction */}
      <GrindPredictionCard coffee={f} baseline={baseline} allCoffees={allCoffees} />
      {grams > 0 && <PortionPlanPreview plan={plan} wholeBag={wholeBag} />}
      {f.roastDate && addAs === 'resting' && (() => {
        const roast = new Date(f.roastDate);
        const freezeDate = new Date(roast.getTime() + restingDays * 86400000);
        const today = new Date();
        const daysUntilFreeze = Math.ceil((freezeDate - today) / 86400000);
        if (daysUntilFreeze > 0) {
          return <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--ice-bg)", border: "1px solid var(--ice)", borderRadius: 6, fontSize: 11, color: "var(--ice)" }}>
            ❄ Freeze in {daysUntilFreeze} day{daysUntilFreeze !== 1 ? "s" : ""} ({freezeDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})
          </div>;
        } else {
          return <div style={{ marginTop: 12, padding: "8px 12px", background: "#E8F5E9", border: "1px solid var(--success)", borderRadius: 6, fontSize: 11, color: "var(--success)" }}>
            ✓ Ready to portion and freeze now!
          </div>;
        }
      })()}
      {addAs === 'frozen' && (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "#E8F5E9", border: "1px solid var(--success)", borderRadius: 6, fontSize: 11, color: "var(--success)" }}>
          ✓ Will be portioned and frozen immediately
        </div>
      )}
      {/* Duplicate warning banner */}
      {duplicateMatch && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--active-bg)", border: "1px solid var(--active)", borderRadius: 8, fontSize: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--active)", fontWeight: 600 }}>
            <span>⚠</span>
            <span>Similar coffee found: {duplicateMatch.match.name}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            {duplicateMatch.isSameBatch ? "Same batch detected — you can add portions to existing." : "Different batch — you can copy the existing recipe."}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={(e) => { e.stopPropagation(); if (f.name && grams > 0) onSubmit({ ...f, wholeBag, status: addAs, targetRestDays: restingDays, dosesPerPortion, _duplicateMatch: duplicateMatch }); }}
          style={{ flex: 1, padding: "9px 0", background: f.name && grams > 0 ? (addAs === 'resting' ? "var(--accent)" : "var(--accent-dark)") : "var(--border)", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600 }}>
          {addAs === 'resting' ? "Start Resting" : "Add to Freezer"}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onCancel(); }}
          style={{ padding: "9px 16px", background: "none", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 13 }}>Discard</button>
      </div>
    </div>
  );
}

function ManualEntry({ onSubmit, onCancel }) {
  const [f, setF] = useState(EMPTY);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const fields = [["name", "Coffee Name *"], ["roaster", "Roaster"], ["country", "Country"], ["region", "Region"], ["variety", "Variety"], ["producer", "Producer"], ["roastLevel", "Roast Level"], ["process", "Process"], ["altitude", "Altitude"], ["weight", "Weight (e.g. 250g) *"], ["price", "Price"], ["roastDate", "Roast Date"], ["tastingNotes", "Tasting Notes"]];
  return (
    <div style={{ padding: 18, textAlign: "left" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", marginBottom: 12 }}>Manual Entry</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px" }}>
        {fields.map(([k, label]) => (
          <div key={k} style={{ gridColumn: k === "name" || k === "tastingNotes" ? "1 / -1" : undefined }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 2 }}>{label}</label>
            <input
              type={k === "roastDate" ? "date" : "text"}
              value={f[k] || ""}
              onChange={(e) => set(k, e.target.value)}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, background: "#fff", color: "var(--text)" }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={() => { if (f.name && f.weight) onSubmit(f); }}
          style={{ flex: 1, padding: "9px 0", background: f.name && f.weight ? "var(--accent-dark)" : "var(--border)", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600 }}>Continue</button>
        <button onClick={onCancel} style={{ padding: "9px 16px", background: "none", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 13 }}>Cancel</button>
      </div>
    </div>
  );
}

function RestingCard({ coffee, onMoveToFreezer, onEdit, onArchive, onRatingChange, onView }) {
  const now = Date.now();
  const roastDate = coffee.roastDate ? new Date(coffee.roastDate) : null;
  const addedAt = new Date(coffee.addedAt);
  const referenceDate = roastDate || addedAt;
  const daysSinceRoast = Math.floor((now - referenceDate.getTime()) / 86400000);

  // Use targetRestDays if set, otherwise default to 14
  const targetDays = coffee.targetRestDays || 14;
  const daysUntilFreeze = Math.max(0, targetDays - daysSinceRoast);
  const isReadyToFreeze = daysUntilFreeze <= 0;
  const progress = Math.min(100, Math.round((daysSinceRoast / targetDays) * 100));

  const freezeDate = new Date(referenceDate.getTime() + targetDays * 86400000);

  return (
    <div
      onClick={() => onView && onView(coffee)}
      style={{
      background: isReadyToFreeze ? "rgba(76, 175, 80, 0.08)" : "var(--card)",
      border: `1.5px solid ${isReadyToFreeze ? "var(--success)" : "var(--border)"}`,
      borderRadius: 10,
      padding: "16px 18px",
      cursor: onView ? "pointer" : "default",
      marginBottom: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        {/* Label card or thumbnail */}
        {coffee.bagColor ? <LabelCard coffee={coffee} size="medium" /> : coffee.labelImage && <LabelThumbnail src={coffee.labelImage} size={56} />}

        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, marginBottom: 3 }}>
            {coffee.name || "Unnamed"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 4 }}>
            {coffee.country && <Badge>{coffee.country}</Badge>}
            {coffee.variety && <Badge bg="#EDE0D0">{coffee.variety}</Badge>}
          </div>
          <Stars value={coffee.rating || 0} onChange={onRatingChange} size={14} />
        </div>

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {isReadyToFreeze ? (
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--success)" }}>Ready to freeze!</div>
          ) : (
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Day {daysSinceRoast} of {targetDays}</div>
          )}
        </div>
      </div>

      {/* Resting status */}
      <div style={{ marginTop: 12, padding: "10px 12px", background: isReadyToFreeze ? "rgba(76, 175, 80, 0.1)" : "#FAF7F4", borderRadius: 8, border: `1px solid ${isReadyToFreeze ? "var(--success)" : "var(--border)"}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 14 }}>○</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: isReadyToFreeze ? "var(--success)" : "var(--muted)" }}>
            {isReadyToFreeze ? "Ready to freeze!" : `Resting · Day ${daysSinceRoast} of ${targetDays}`}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 8, background: "#EDE8E2", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${progress}%`,
              background: isReadyToFreeze ? "var(--success)" : "var(--accent)",
              borderRadius: 4,
              transition: "width 0.3s",
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>{progress}%</span>
        </div>

        {/* Dates */}
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          {roastDate && (
            <div>Roasted: {roastDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ({daysSinceRoast} day{daysSinceRoast !== 1 ? "s" : ""} ago)</div>
          )}
          {!isReadyToFreeze && (
            <div>Ready to freeze: {freezeDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ({daysUntilFreeze} day{daysUntilFreeze !== 1 ? "s" : ""})</div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onMoveToFreezer(coffee.id); }}
          style={{
            flex: 1,
            padding: "9px 0",
            background: isReadyToFreeze ? "var(--ice)" : "var(--card)",
            color: isReadyToFreeze ? "#fff" : "var(--ice)",
            border: `1.5px solid var(--ice)`,
            borderRadius: 7,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ❄ Move to Freezer
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(coffee); }}
          style={{
            padding: "9px 14px",
            background: "none",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
            borderRadius: 7,
            fontSize: 12,
          }}
          title="Edit"
        >✎</button>
        <button
          onClick={(e) => { e.stopPropagation(); onArchive(coffee.id); }}
          style={{
            padding: "9px 14px",
            background: "none",
            border: "1px solid var(--done)",
            color: "var(--done)",
            borderRadius: 7,
            fontSize: 12,
          }}
          title="Archive"
        >✓</button>
      </div>
    </div>
  );
}

// ─── Main ───
export default function Home() {
  const { user, signOut } = useAuth();
  const { coffees, loading: coffeesLoading, addCoffee: addCoffeeToDb, updateCoffee: updateCoffeeInDb, moveToFreezer, archiveCoffee: archiveCoffeeInDb, deleteCoffee: deleteCoffeeFromDb, uploadLabelImage, migrateRestingCoffees } = useCoffees();
  const { baselineGrind, baselineGrindInput, setBaselineGrind, doseG, setDoseG, loading: settingsLoading } = useSettings();
  const loaded = !coffeesLoading && !settingsLoading;
  const [showSettings, setShowSettings] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [pendingRating, setPendingRating] = useState(0);
  const [view, setView] = useState("overview");
  const [expanded, setExpanded] = useState(null);
  const [freezerSort, setFreezerSort] = useState("longest");
  const [migrating, setMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const fileRef = useRef(null);

  // Duplicate detection state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingCoffeeData, setPendingCoffeeData] = useState(null);
  const [duplicateMatch, setDuplicateMatch] = useState(null);

  const update = (id, patch) => updateCoffeeInDb(id, patch);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const del = (id) => {
    if (window.confirm("Are you sure you want to delete this coffee? This cannot be undone.")) {
      deleteCoffeeFromDb(id);
    }
  };

  const archiveCoffee = (id) => {
    archiveCoffeeInDb(id);
  };

  const [editingCoffee, setEditingCoffee] = useState(null);
  const [viewingCoffee, setViewingCoffee] = useState(null);
  const handleEditSave = async (data) => {
    if (!editingCoffee) return;
    await update(editingCoffee.id, data);
    setEditingCoffee(null);
  };

  const activeCoffees = useMemo(() => coffees.filter((c) => c.status === "active").sort((a, b) => new Date(a.pulledAt) - new Date(b.pulledAt)), [coffees]);
  const restingCoffees = useMemo(() => coffees.filter((c) => c.status === "resting").sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt)), [coffees]);
  const restingNeedsMigration = useMemo(() => restingCoffees.filter(c => !c.targetRestDays).length, [restingCoffees]);
  const frozen = useMemo(() => coffees.filter((c) => c.status === "frozen").sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt)), [coffees]);
  const archive = useMemo(() => coffees.filter((c) => c.status === "done").sort((a, b) => new Date(b.finishedAt || b.addedAt) - new Date(a.finishedAt || a.addedAt)), [coffees]);
  // Include remaining portions from active coffees in freezer totals
  const allWithFrozenPortions = useMemo(() => [...frozen, ...activeCoffees.filter(c => c.portionIndex + 1 < c.portions.length)], [frozen, activeCoffees]);
  const totalFrozenGrams = useMemo(() => {
    let total = frozen.reduce((s, c) => s + c.portions.slice(c.portionIndex).reduce((ss, p) => ss + p.grams, 0), 0);
    // Add remaining portions from active coffees (skip current portion)
    total += activeCoffees.reduce((s, c) => s + c.portions.slice(c.portionIndex + 1).reduce((ss, p) => ss + p.grams, 0), 0);
    return total;
  }, [frozen, activeCoffees]);
  const totalFrozenDoses = useMemo(() => {
    let total = frozen.reduce((s, c) => s + c.portions.slice(c.portionIndex).reduce((ss, p) => ss + p.doses, 0), 0);
    total += activeCoffees.reduce((s, c) => s + c.portions.slice(c.portionIndex + 1).reduce((ss, p) => ss + p.doses, 0), 0);
    return total;
  }, [frozen, activeCoffees]);
  const totalFrozenPortions = useMemo(() => {
    let total = frozen.reduce((s, c) => s + (c.portions.length - c.portionIndex), 0);
    total += activeCoffees.reduce((s, c) => s + Math.max(0, c.portions.length - c.portionIndex - 1), 0);
    return total;
  }, [frozen, activeCoffees]);
  const totalFreezerBags = useMemo(() => {
    // Count frozen bags + active bags that have remaining portions in freezer
    const activeWithRemaining = activeCoffees.filter(c => c.portionIndex + 1 < c.portions.length);
    return frozen.length + activeWithRemaining.length;
  }, [frozen, activeCoffees]);
  const [showAllActive, setShowAllActive] = useState(false);

  const pull = async (id) => {
    await update(id, { status: "active", dosesUsed: 0, pulledAt: new Date().toISOString() });
    setView("morning");
  };

  const finishPortion = (coffee) => {
    if (!coffee) return;
    const ni = coffee.portionIndex + 1;
    update(coffee.id, ni < coffee.portions.length ? { status: "frozen", dosesUsed: 0, portionIndex: ni } : { status: "done", finishedAt: new Date().toISOString() });
  };

  const handleFile = useCallback(async (file) => {
    if (!file?.type?.startsWith("image/")) { setError("Select an image."); return; }
    setError(null); setParsed(null); setPendingRating(0); setManualMode(false);

    let processedFile = file;
    const isHeic = file.type === "image/heic" || file.type === "image/heif" || file.name?.toLowerCase().endsWith(".heic");

    // HEIC not supported - guide user to alternatives
    if (isHeic) {
      setError("HEIC format not supported. Take a screenshot of your photo, or go to Settings → Camera → Formats → Most Compatible to use JPEG.");
      return;
    }

    const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!supportedTypes.includes(processedFile.type)) {
      setError(`Unsupported format (${file.type}). Use JPEG, PNG, GIF, or WebP.`);
      return;
    }

    // Always compress to stay under API limit and speed up upload
    processedFile = await compressImage(processedFile);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(processedFile);

    const b64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(",")[1]);
      r.onerror = () => rej();
      r.readAsDataURL(processedFile);
    });

    setScanning(true);
    try {
      const resp = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64, mediaType: processedFile.type }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `Server error ${resp.status}`);
      setParsed(data);
    } catch (err) {
      setError(`Scan failed: ${err.message}`);
      setManualMode(true);
    } finally {
      setScanning(false);
    }
  }, []);

  const addCoffee = async (data, rating) => {
    const grams = parseGrams(data.weight);
    const effectiveDoseG = doseG || DEFAULT_DOSE_G;
    const effectiveDosesPerPortion = data.dosesPerPortion || DEFAULT_DOSES_PER_PORTION;
    const plan = data.wholeBag
      ? { portions: [{ grams, doses: Math.floor(grams / effectiveDoseG), buffer: grams % effectiveDoseG }] }
      : optimizePortions(grams, effectiveDoseG, effectiveDosesPerPortion);
    const prediction = calculateGrindOffset(data);

    // Upload label image to storage if present
    let labelImage = preview;
    if (preview && preview.startsWith('data:')) {
      const uploadedUrl = await uploadLabelImage(preview);
      if (uploadedUrl) labelImage = uploadedUrl;
    }

    // Use the status from data (resting or frozen), defaulting to frozen
    const status = data.status || "frozen";

    const coffeeData = {
      ...data,
      rating: rating || 0,
      gramsTotal: grams,
      portions: plan.portions,
      portionIndex: 0,
      dosesUsed: 0,
      status,
      espresso: null,
      favorite: false,
      doseG: doseG || DEFAULT_DOSE_G,
      labelImage,
      grindOffsetPrediction: prediction.offset,
      grindOffsetRationale: prediction.rationale,
      grindConfidence: prediction.confidence,
    };

    try {
      const result = await addCoffeeToDb(coffeeData);
      if (!result) {
        setError("Failed to save coffee. Check console for details.");
        console.error("addCoffeeToDb returned null - check Supabase error");
        return;
      }
      setParsed(null); setPreview(null); setPendingRating(0); setManualMode(false); setError(null);
      // Navigate to appropriate view based on status
      setView(status === "resting" ? "resting" : "freezer");
    } catch (err) {
      setError(`Failed to save: ${err.message}`);
      console.error("Error adding coffee:", err);
    }
  };

  const resetScan = () => { setParsed(null); setPreview(null); setManualMode(false); setError(null); };
  const handleDrop = useCallback((e) => { e.preventDefault(); handleFile(e.dataTransfer?.files?.[0]); }, [handleFile]);

  // Duplicate detection handlers
  const handleSubmitWithDuplicateCheck = (data) => {
    const { _duplicateMatch, ...coffeeData } = data;
    if (_duplicateMatch) {
      // Store pending data and show modal
      setPendingCoffeeData(coffeeData);
      setDuplicateMatch(_duplicateMatch);
      setShowDuplicateModal(true);
    } else {
      // No duplicate, add normally
      addCoffee(coffeeData, 0);
    }
  };

  const handleMergePortions = async () => {
    if (!duplicateMatch || !pendingCoffeeData) return;
    const existing = duplicateMatch.match;
    const newGrams = parseGrams(pendingCoffeeData.weight);
    const effectiveDoseG = doseG || DEFAULT_DOSE_G;

    const merged = mergePortions(existing, newGrams, effectiveDoseG);
    if (merged) {
      await updateCoffeeInDb(existing.id, {
        portions: merged.portions,
        gramsTotal: merged.gramsTotal,
        portionIndex: merged.portionIndex,
        dosesUsed: merged.dosesUsed,
      });
    }

    // Reset state
    setShowDuplicateModal(false);
    setPendingCoffeeData(null);
    setDuplicateMatch(null);
    resetScan();
    setView("freezer");
  };

  const handleCopyRecipe = async () => {
    if (!duplicateMatch || !pendingCoffeeData) return;
    const existing = duplicateMatch.match;

    // Add new coffee with copied espresso settings
    await addCoffee({
      ...pendingCoffeeData,
      espresso: existing.espresso || null,
    }, 0);

    // Reset state
    setShowDuplicateModal(false);
    setPendingCoffeeData(null);
    setDuplicateMatch(null);
  };

  const handleStartFresh = async () => {
    if (!pendingCoffeeData) return;

    // Add new coffee without any copied data
    await addCoffee(pendingCoffeeData, 0);

    // Reset state
    setShowDuplicateModal(false);
    setPendingCoffeeData(null);
    setDuplicateMatch(null);
  };

  const closeDuplicateModal = () => {
    setShowDuplicateModal(false);
    setPendingCoffeeData(null);
    setDuplicateMatch(null);
  };
  const rp = (c) => c.portions.length - c.portionIndex;
  const rg = (c) => c.portions.slice(c.portionIndex).reduce((s, p) => s + p.grams, 0);
  const curP = (c) => c.portions[c.portionIndex];

  const stats = useStats(coffees);

  const nav = [
    { key: "overview", icon: "◐", label: "Home" },
    { key: "morning", icon: "☀", label: "Active" },
    { key: "resting", icon: "○", label: "Resting" },
    { key: "freezer", icon: "❄", label: "Freezer" },
    { key: "scan", icon: "◎", label: "Scan" },
    { key: "archive", icon: "≡", label: "Archive" },
  ];

  if (!loaded) return null;

  return (
    <>
      <Head>
        <title>Expertso</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
        <meta name="description" content="Coffee inventory tracker" />

        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#5C2D0E" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* iOS */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Expertso" />
        <link rel="apple-touch-icon" href="/icon-192.png" />

        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/icon.svg" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />

        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Caveat:wght@400;700&family=Dancing+Script:wght@400;700&family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;700;900&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 16px", background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <img src="https://txoekzciwkstblucxhah.supabase.co/storage/v1/object/public/Logo/Expertso%20logo.png" alt="Expertso" style={{ height: 67 }} />
            <button onClick={() => setShowSettings(!showSettings)} style={{ background: "none", border: "none", fontSize: 18, color: showSettings ? "var(--accent)" : "var(--muted)", cursor: "pointer", padding: 4, position: "absolute", right: 0 }}>○</button>
          </div>
          {showSettings && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: "#FAF7F4", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", marginBottom: 8 }}>Grind Settings</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ fontSize: 12, color: "var(--text)", flex: 1 }}>Baseline Grind Setting</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={baselineGrindInput}
                  onChange={(e) => setBaselineGrind(e.target.value)}
                  placeholder="e.g. 4.5"
                  style={{ width: 80, padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 5, fontSize: 12, fontFamily: "'DM Mono', monospace", textAlign: "center" }}
                />
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>Your typical setting for a medium-roast washed coffee</div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", marginBottom: 8 }}>Account</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{user?.email}</span>
                  <button onClick={signOut} style={{ padding: "5px 10px", background: "none", border: "1px solid var(--border)", borderRadius: 5, fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>Sign Out</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Freezer Stats Bar */}
        <div style={{ padding: "8px 20px", background: "var(--bg)", borderBottom: "1px solid var(--border)", textAlign: "center", fontSize: 11, color: "var(--muted)" }}>
          {totalFrozenGrams > 0 ? `${totalFrozenGrams}g · ${totalFrozenDoses} doses · ${totalFrozenPortions} portion${totalFrozenPortions !== 1 ? "s" : ""} in freezer` : activeCoffees.length > 0 ? "Freezer empty — active bag only" : "No coffee tracked yet"}
        </div>

        <div style={{ maxWidth: 540, margin: "0 auto", padding: "16px 16px 0" }}>
          <DataMigration />

          {/* ─── OVERVIEW ─── */}
          {view === "overview" && (
            <Overview
              stats={stats}
              onUseDose={() => {
                const active = activeCoffees[0];
                if (active && active.dosesUsed < active.portions[active.portionIndex]?.doses) {
                  update(active.id, { dosesUsed: active.dosesUsed + 1 });
                }
              }}
              onPullFromFreezer={() => setView("freezer")}
              onViewResting={() => setView("resting")}
            />
          )}

          {/* ─── ACTIVE ─── */}
          {view === "morning" && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--active)", marginBottom: 10 }}>● Active{activeCoffees.length > 1 ? ` (${activeCoffees.length})` : ""}</div>
              {activeCoffees.length > 0 ? (
                <>
                  {(showAllActive ? activeCoffees : activeCoffees.slice(0, 2)).map((active) => {
                    const cur = curP(active);
                    const dosesLeft = cur ? cur.doses - active.dosesUsed : 0;
                    const gramsLeft = dosesLeft * (active.doseG || DEFAULT_DOSE_G) + (dosesLeft > 0 ? cur.buffer : 0);
                    const more = rp(active) - 1;
                    const daysSincePull = active.pulledAt ? Math.floor((Date.now() - new Date(active.pulledAt).getTime()) / 86400000) : 0;
                    return (
                      <div key={active.id} style={{ background: "var(--active-bg)", border: "1.5px solid var(--active)", borderRadius: 10, padding: "16px 18px", marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ display: "flex", gap: 12, flex: 1 }}>
                            {active.bagColor ? <LabelCard coffee={active} size="large" /> : active.labelImage && <LabelThumbnail src={active.labelImage} size={64} />}
                            <div>
                              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{active.name || "Unnamed"}</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
                                {active.country && <Badge>{active.country}</Badge>}
                                {active.variety && <Badge bg="#EDE0D0">{active.variety}</Badge>}
                                {active.roastLevel && <Badge bg="#E5DDD4">{active.roastLevel}</Badge>}
                              </div>
                              <Stars value={active.rating || 0} onChange={(r) => update(active.id, { rating: r })} />
                            </div>
                          </div>
                          <div style={{ textAlign: "right", fontSize: 11, color: "var(--muted)" }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--active)" }}>~{gramsLeft}g</div>
                            <div>{dosesLeft} dose{dosesLeft !== 1 ? "s" : ""} left</div>
                            <div style={{ marginTop: 2, color: daysSincePull > 7 ? "var(--error)" : "var(--muted)" }}>
                              {daysSincePull === 0 ? "Pulled today" : `${daysSincePull}d out of freezer`}
                            </div>
                            {more > 0 && <div style={{ color: "var(--ice)", fontWeight: 600, marginTop: 3 }}>+{more} portion{more !== 1 ? "s" : ""} in freezer</div>}
                          </div>
                        </div>
                        {cur && <DoseTracker portion={cur} dosesUsed={active.dosesUsed} onChange={(d) => update(active.id, { dosesUsed: d })} doseG={active.doseG || DEFAULT_DOSE_G} />}
                        <EspressoRecipe recipe={active.espresso} onChange={(esp) => update(active.id, { espresso: esp })} coffee={active} baseline={baselineGrind} allCoffees={coffees} />
                        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                          <button onClick={(e) => { e.stopPropagation(); finishPortion(active); }} style={{ flex: 1, padding: "9px 0", background: "var(--accent-dark)", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600 }}>
                            {more > 0 ? "Portion done → freezer" : "Bag finished"}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setViewingCoffee(active); }} style={{ padding: "9px 12px", background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 7, fontSize: 12 }} title="View Details">i</button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingCoffee(active); }} style={{ padding: "9px 12px", background: "none", border: "1px solid var(--accent)", color: "var(--accent)", borderRadius: 7, fontSize: 12 }} title="Edit">✎</button>
                          <button onClick={(e) => { e.stopPropagation(); update(active.id, { status: "frozen" }); }} style={{ padding: "9px 12px", background: "none", border: "1px solid var(--ice)", color: "var(--ice)", borderRadius: 7, fontSize: 12 }} title="Put back in freezer">❄</button>
                          <button onClick={(e) => { e.stopPropagation(); del(active.id); }} style={{ padding: "9px 12px", background: "none", border: "1px solid var(--error)", color: "var(--error)", borderRadius: 7, fontSize: 12 }} title="Delete">✕</button>
                        </div>
                      </div>
                    );
                  })}
                  {activeCoffees.length > 2 && !showAllActive && (
                    <button onClick={() => setShowAllActive(true)} style={{ width: "100%", padding: "8px", background: "none", border: "1px solid var(--border)", borderRadius: 7, fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
                      Show {activeCoffees.length - 2} more active
                    </button>
                  )}
                  {frozen.length > 0 && (
                    <button onClick={() => setView("freezer")} style={{ width: "100%", padding: "10px", background: "var(--ice-bg)", border: "1px solid var(--ice)", borderRadius: 7, fontSize: 12, color: "var(--ice)", fontWeight: 600, marginBottom: 12 }}>
                      + Pull another from freezer
                    </button>
                  )}
                </>
              ) : (
                <div style={{ background: "var(--card)", border: "1.5px dashed var(--border)", borderRadius: 10, padding: "28px 18px", textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>No active bag</div>
                  <button onClick={() => setView(frozen.length > 0 ? "freezer" : "scan")} style={{
                    padding: "8px 20px", background: frozen.length > 0 ? "var(--ice)" : "var(--accent)", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600,
                  }}>{frozen.length > 0 ? "Pull from freezer" : "Scan a bag"}</button>
                </div>
              )}
              {frozen.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--ice)", marginBottom: 10 }}>❄ Up Next</div>
                  {frozen.slice(0, 3).map((c) => (
                    <div key={c.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        {c.bagColor ? <LabelCard coffee={c} size="small" /> : c.labelImage && <LabelThumbnail src={c.labelImage} size={44} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name || "Unnamed"}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.country}{c.variety ? ` · ${c.variety}` : ""} · {rp(c)} portion{rp(c) !== 1 ? "s" : ""} · {rg(c)}g</div>
                        </div>
                        <div style={{ textAlign: "right", marginRight: 10 }}>
                          <div style={{ fontSize: 10, color: "var(--ice)", fontWeight: 600 }}>❄ {fmt(c.addedAt)}</div>
                          <div style={{ fontSize: 9, color: "var(--muted)" }}>{daysAgo(c.addedAt)}</div>
                        </div>
                        <button onClick={() => pull(c.id)} style={{ padding: "6px 14px", background: "var(--ice)", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>Pull</button>
                      </div>
                      {c.espresso && (c.espresso.dose || c.espresso.grind) && (
                        <div style={{ marginTop: 8, padding: "6px 8px", background: "#FAF7F4", borderRadius: 5, fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--text)" }}>
                          <span style={{ fontSize: 9, fontWeight: 600, color: "var(--accent)", marginRight: 6 }}>RECIPE:</span>
                          {c.espresso.dose && <span>{c.espresso.dose}g → </span>}
                          {c.espresso.yield && <span>{c.espresso.yield}g </span>}
                          {(c.espresso.totalTime || c.espresso.time) && <span>{c.espresso.totalTime || c.espresso.time}s </span>}
                          {c.espresso.grind && <span>@{c.espresso.grind} </span>}
                          {c.espresso.feedSpeed && <span>{c.espresso.feedSpeed} </span>}
                          {c.espresso.temp && <span>{c.espresso.temp}°{c.espresso.tempUnit || ""}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                  {frozen.length > 3 && <button onClick={() => setView("freezer")} style={{ width: "100%", padding: "8px", background: "none", border: "1px solid var(--border)", borderRadius: 7, fontSize: 11, color: "var(--muted)" }}>See all {frozen.length} in freezer</button>}
                </div>
              )}
            </div>
          )}

          {/* ─── FREEZER ─── */}
          {view === "freezer" && (() => {
            // Include remaining portions from active coffees
            const activeWithRemaining = activeCoffees.filter(c => c.portionIndex + 1 < c.portions.length);
            const allFreezerItems = [...frozen, ...activeWithRemaining.map(c => ({ ...c, isActiveRemaining: true }))];

            // Sort freezer items based on selected sort option
            const getRemainingPortions = (c) => c.isActiveRemaining
              ? c.portions.length - c.portionIndex - 1
              : c.portions.length - c.portionIndex;

            const sortedFreezerItems = [...allFreezerItems].sort((a, b) => {
              switch (freezerSort) {
                case "newest":
                  return new Date(b.addedAt) - new Date(a.addedAt);
                case "oldest-roast":
                  return new Date(a.roastDate || 0) - new Date(b.roastDate || 0);
                case "freshest-roast":
                  return new Date(b.roastDate || 0) - new Date(a.roastDate || 0);
                case "almost-done":
                  return getRemainingPortions(a) - getRemainingPortions(b);
                case "most-remaining":
                  return getRemainingPortions(b) - getRemainingPortions(a);
                default: // "longest"
                  return new Date(a.addedAt) - new Date(b.addedAt);
              }
            });

            return (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--ice)", marginBottom: 8 }}>❄ Freezer — {totalFrozenPortions} portion{totalFrozenPortions !== 1 ? "s" : ""} · {totalFrozenGrams}g · {totalFrozenDoses} doses</div>
              {allFreezerItems.length > 0 && (
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, marginBottom: 6, WebkitOverflowScrolling: "touch" }}>
                  {FREEZER_SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setFreezerSort(freezerSort === opt.key ? "longest" : opt.key)}
                      style={{
                        padding: "5px 10px",
                        background: freezerSort === opt.key ? "var(--ice)" : "var(--card)",
                        color: freezerSort === opt.key ? "#fff" : "var(--muted)",
                        border: `1px solid ${freezerSort === opt.key ? "var(--ice)" : "var(--border)"}`,
                        borderRadius: 16,
                        fontSize: 11,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              {sortedFreezerItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)", fontSize: 13 }}>Freezer empty.<br /><button onClick={() => setView("scan")} style={{ marginTop: 12, padding: "8px 20px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600 }}>Scan a bag</button></div>
              ) : sortedFreezerItems.map((c) => {
                const isExp = expanded === c.id;
                return (
                  <div key={c.id} onClick={() => setExpanded(isExp ? null : c.id)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 10, cursor: "pointer", boxShadow: isExp ? "0 3px 16px rgba(92,45,14,0.06)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      {c.bagColor ? <LabelCard coffee={c} size="medium" /> : c.labelImage && <LabelThumbnail src={c.labelImage} size={56} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, marginBottom: 3 }}>
                          {c.name || "Unnamed"} {c.favorite && <span style={{ color: "var(--star)", fontSize: 13 }}>★</span>}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 4 }}>
                          {c.country && <Badge>{c.country}</Badge>}
                          {c.variety && <Badge bg="#EDE0D0">{c.variety}</Badge>}
                          {c.process && <Badge bg="#E5DDD4">{c.process}</Badge>}
                        </div>
                        <Stars value={c.rating || 0} onChange={(r) => update(c.id, { rating: r })} size={14} />
                        {c.tastingNotes && <div style={{ fontSize: 10, color: "var(--muted)", fontStyle: "italic", marginTop: 4, lineHeight: 1.3 }}>"{c.tastingNotes}"</div>}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ice)" }}>{c.isActiveRemaining ? c.portions.slice(c.portionIndex + 1).reduce((s, p) => s + p.grams, 0) : rg(c)}g</div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>{c.isActiveRemaining ? c.portions.length - c.portionIndex - 1 : rp(c)} portion{(c.isActiveRemaining ? c.portions.length - c.portionIndex - 1 : rp(c)) !== 1 ? "s" : ""}</div>
                        {c.isActiveRemaining && <div style={{ fontSize: 10, color: "var(--active)", fontWeight: 600, marginTop: 2 }}>● 1 active</div>}
                        {c.roastDate && <div style={{ marginTop: 2 }}><span style={{ padding: "2px 6px", background: "var(--accent-light)", borderRadius: 4, fontSize: 10, fontWeight: 600, color: "var(--accent-dark)", fontFamily: "'DM Mono', monospace" }}>{getRoastQuarter(c.roastDate)}</span></div>}
                        <div style={{ fontSize: 10, color: "var(--ice)", fontWeight: 600, marginTop: 2 }}>❄ {fmt(c.addedAt)}</div>
                        <div style={{ fontSize: 9, color: "var(--muted)" }}>{daysAgo(c.addedAt)}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {c.portions.map((p, i) => {
                        const used = i < c.portionIndex;
                        const isCur = i === c.portionIndex;
                        const isActive = c.isActiveRemaining && isCur;
                        return (
                          <div key={i} style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: used ? "#EDEAE7" : isActive ? "var(--active-bg)" : isCur ? "var(--ice-bg)" : "#F8F5F2", border: `1px solid ${used ? "#D5CEC6" : isActive ? "var(--active)" : isCur ? "var(--ice)" : "var(--border)"}`, color: used ? "#A09890" : isActive ? "var(--active)" : isCur ? "var(--ice)" : "var(--muted)", textDecoration: used ? "line-through" : "none" }}>
                            {p.grams}g · {p.doses}d{p.buffer > 0 && !used ? ` +${p.buffer}` : ""}{isActive ? " ●" : ""}
                          </div>
                        );
                      })}
                    </div>
                    {isExp && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
                        {(c.bagColor || c.labelImage) && (
                          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center", gap: 12, alignItems: "center" }}>
                            {c.bagColor && <LabelCard coffee={c} size="large" />}
                            {c.labelImage && <LabelThumbnail src={c.labelImage} size={80} />}
                          </div>
                        )}
                        {c.espresso && (c.espresso.dose || c.espresso.yield || c.espresso.totalTime || c.espresso.time || c.espresso.grind) && (
                          <div style={{ marginBottom: 10, padding: "10px 12px", background: "linear-gradient(135deg, #FDF8F4 0%, #FAF0E6 100%)", border: "1.5px solid var(--accent-light, #E8D5C4)", borderRadius: 8, boxShadow: "0 2px 6px rgba(92,45,14,0.06)" }}>
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", marginBottom: 6 }}>● Espresso Recipe</div>
                            <div style={{ display: "flex", gap: 10, fontSize: 13, fontFamily: "'DM Mono', monospace", flexWrap: "wrap", color: "var(--text)", fontWeight: 500 }}>
                              {c.espresso.dose && <span>{c.espresso.dose}g →</span>}
                              {c.espresso.yield && <span>{c.espresso.yield}g</span>}
                            </div>
                            <div style={{ display: "flex", gap: 12, fontSize: 11, fontFamily: "'DM Mono', monospace", flexWrap: "wrap", color: "var(--muted)", marginTop: 4 }}>
                              {(c.espresso.totalTime || c.espresso.time) && <span>{c.espresso.totalTime || c.espresso.time}s{c.espresso.preInfuse ? ` (pre:${c.espresso.preInfuse}s)` : ""}{c.espresso.brewTime ? ` (brew:${c.espresso.brewTime}s)` : ""}</span>}
                              {c.espresso.grind && <span>@{c.espresso.grind}{c.espresso.feedSpeed ? ` · ${c.espresso.feedSpeed}` : ""}</span>}
                              {c.espresso.temp && <span>{c.espresso.temp}°{c.espresso.tempUnit || "C"}</span>}
                            </div>
                            {c.espresso.notes && <div style={{ marginTop: 6, fontSize: 11, fontStyle: "italic", borderTop: "1px solid var(--border)", paddingTop: 6 }}>"{c.espresso.notes}"</div>}
                          </div>
                        )}
                        {[["Roaster", c.roaster], ["Producer", c.producer], ["Region", c.region], ["Roast", c.roastLevel], ["Altitude", c.altitude], ["Price", c.price]]
                          .filter(([, v]) => v).map(([l, v]) => <div key={l}><strong style={{ color: "var(--text)" }}>{l}:</strong> {v}</div>)}
                        {c.tastingNotes && <div style={{ marginTop: 4, fontStyle: "italic" }}>"{c.tastingNotes}"</div>}
                        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                          {!c.isActiveRemaining && <button onClick={(e) => { e.stopPropagation(); pull(c.id); }} style={{ flex: 1, padding: "8px 0", background: "var(--ice)", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600 }}>Pull a portion</button>}
                          {c.isActiveRemaining && <div style={{ flex: 1, padding: "8px 0", background: "var(--active-bg)", border: "1px solid var(--active)", borderRadius: 7, fontSize: 12, fontWeight: 600, textAlign: "center", color: "var(--active)" }}>Finish active portion first</div>}
                          <button onClick={(e) => { e.stopPropagation(); setViewingCoffee(c); }} style={{ padding: "8px 14px", background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 7, fontSize: 12 }} title="View Details">i</button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingCoffee(c); }} style={{ padding: "8px 14px", background: "none", border: "1px solid var(--accent)", color: "var(--accent)", borderRadius: 7, fontSize: 12 }} title="Edit">✎</button>
                          <button onClick={(e) => { e.stopPropagation(); update(c.id, { favorite: !c.favorite }); }} style={{ padding: "8px 14px", background: "none", border: `1px solid ${c.favorite ? "var(--star)" : "var(--border)"}`, color: c.favorite ? "var(--star)" : "var(--muted)", borderRadius: 7, fontSize: 12, fontWeight: 600 }}>{c.favorite ? "★" : "☆"}</button>
                          <button onClick={(e) => { e.stopPropagation(); archiveCoffee(c.id); }} style={{ padding: "8px 14px", background: "none", border: "1px solid var(--done)", color: "var(--done)", borderRadius: 7, fontSize: 12 }} title="Archive">✓</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );})()}

          {/* ─── RESTING ─── */}
          {view === "resting" && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--accent)", marginBottom: 10 }}>○ Resting — {restingCoffees.length} bag{restingCoffees.length !== 1 ? "s" : ""}</div>

              {/* Migration banner for coffees without smart degas */}
              {restingNeedsMigration > 0 && !migrationResult && (
                <div style={{ marginBottom: 12, padding: "12px 14px", background: "var(--accent-light)", border: "1px solid var(--accent)", borderRadius: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 14 }}>💡</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-dark)" }}>
                      Smart degas available for {restingNeedsMigration} coffee{restingNeedsMigration !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--accent-dark)", marginBottom: 10, lineHeight: 1.5 }}>
                    Update rest periods based on roast level, process, and altitude for more accurate degassing.
                  </div>
                  <button
                    onClick={async () => {
                      setMigrating(true);
                      const result = await migrateRestingCoffees();
                      setMigrationResult(result);
                      setMigrating(false);
                    }}
                    disabled={migrating}
                    style={{
                      padding: "8px 16px",
                      background: migrating ? "var(--muted)" : "var(--accent)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: migrating ? "wait" : "pointer",
                    }}
                  >
                    {migrating ? "Updating..." : "Update Rest Periods"}
                  </button>
                </div>
              )}

              {/* Migration success message */}
              {migrationResult && (
                <div style={{ marginBottom: 12, padding: "12px 14px", background: "#E8F5E9", border: "1px solid var(--success)", borderRadius: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success)" }}>
                      ✓ Updated {migrationResult.updated} coffee{migrationResult.updated !== 1 ? "s" : ""} with smart degas periods
                    </span>
                    <button
                      onClick={() => setMigrationResult(null)}
                      style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16 }}
                    >×</button>
                  </div>
                </div>
              )}

              {restingCoffees.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)", fontSize: 13 }}>
                  No coffees resting.<br />
                  <button onClick={() => setView("scan")} style={{ marginTop: 12, padding: "8px 20px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600 }}>Scan a bag</button>
                </div>
              ) : (
                restingCoffees.map((c) => (
                  <RestingCard
                    key={c.id}
                    coffee={c}
                    onMoveToFreezer={moveToFreezer}
                    onEdit={setEditingCoffee}
                    onArchive={archiveCoffee}
                    onRatingChange={(r) => update(c.id, { rating: r })}
                    onView={setViewingCoffee}
                  />
                ))
              )}
              {stats.readyToFreezeCount > 0 && (
                <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(76, 175, 80, 0.1)", border: "1px solid var(--success)", borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--success)" }}>
                    {stats.readyToFreezeCount} coffee{stats.readyToFreezeCount !== 1 ? "s" : ""} ready to freeze!
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── SCAN ─── */}
          {view === "scan" && (
            <div>
              <div style={{ border: `2px dashed ${scanning ? "var(--accent-light)" : "var(--border)"}`, borderRadius: 12, padding: (preview || manualMode) ? 0 : "36px 20px", textAlign: "center", cursor: scanning ? "wait" : parsed || manualMode ? "default" : "pointer", background: scanning ? "#FAF5F0" : "var(--card)", transition: "all 0.3s", overflow: "hidden", marginBottom: 16 }}
                onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
                onClick={() => !scanning && !parsed && !manualMode && fileRef.current?.click()}>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                  onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />

                {preview && !parsed && !manualMode && scanning && (
                  <div style={{ position: "relative" }}>
                    <img src={preview} alt="" style={{ width: "100%", maxHeight: 240, objectFit: "cover", display: "block" }} />
                    <div style={{ position: "absolute", inset: 0, background: "rgba(92,45,14,0.6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                      <div style={{ width: 28, height: 28, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600 }}>Reading label…</div>
                    </div>
                  </div>
                )}

                {!preview && !parsed && !manualMode && !scanning && (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 6, opacity: 0.7 }}>◎</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)", marginBottom: 3 }}>Snap or drop a coffee bag</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>Auto-parsed → optimally portioned → frozen</div>
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                      <button onClick={(e) => { e.stopPropagation(); setManualMode(true); }} style={{ padding: "6px 16px", background: "none", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, color: "var(--muted)" }}>Or enter manually</button>
                    </div>
                  </>
                )}

                {manualMode && !parsed && <ManualEntry onSubmit={(d) => { setParsed(d); setManualMode(false); }} onCancel={resetScan} />}

                {parsed && <EditableResult data={parsed} onChange={setParsed} onSubmit={handleSubmitWithDuplicateCheck} onCancel={resetScan} doseG={doseG} setDoseG={setDoseG} baseline={baselineGrind} allCoffees={coffees} />}
              </div>
              {error && <div style={{ padding: "10px 14px", background: "#FDF0E8", border: "1px solid var(--error)", borderRadius: 7, fontSize: 12, color: "var(--error)", marginBottom: 12, lineHeight: 1.5 }}>{error}</div>}
            </div>
          )}

          {/* ─── ARCHIVE ─── */}
          {view === "archive" && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--done)", marginBottom: 12 }}>Archive — {archive.length} bag{archive.length !== 1 ? "s" : ""}</div>
              {archive.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)", fontSize: 13 }}>Nothing here yet.</div>
              ) : archive.map((c) => (
                <div key={c.id} onClick={() => setViewingCoffee(c)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        {c.name || "Unnamed"} {c.favorite && <span style={{ color: "var(--star)", fontSize: 12 }}>★</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.country}{c.variety ? ` · ${c.variety}` : ""} · {c.gramsTotal}g · {fmtFull(c.addedAt)}</div>
                      <Stars value={c.rating || 0} size={12} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={(e) => { e.stopPropagation(); setEditingCoffee(c); }} style={{ padding: "8px 14px", background: "none", border: "1px solid var(--accent)", color: "var(--accent)", borderRadius: 5, fontSize: 11 }} title="Edit">✎</button>
                      <button onClick={(e) => { e.stopPropagation(); del(c.id); }} style={{ padding: "8px 14px", background: "none", border: "1px solid var(--error)", color: "var(--error)", borderRadius: 5, fontSize: 11 }} title="Delete">✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nav */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--card)", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center", padding: "6px 0 env(safe-area-inset-bottom, 10px)" }}>
          <div style={{ display: "flex", maxWidth: 540, width: "100%" }}>
            {nav.map((n) => (
              <button key={n.key} onClick={() => { setView(n.key); setExpanded(null); }} style={{
                flex: 1, padding: "8px 0 4px", background: "none", border: "none",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                color: view === n.key ? "var(--accent-dark)" : "var(--muted)", transition: "color 0.2s",
              }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{n.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>{n.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingCoffee && (
        <EditCoffeeModal
          coffee={editingCoffee}
          onSave={handleEditSave}
          onCancel={() => setEditingCoffee(null)}
        />
      )}

      {/* Detail Modal */}
      {viewingCoffee && (
        <CoffeeDetailModal
          coffee={viewingCoffee}
          onClose={() => setViewingCoffee(null)}
          onEdit={(c) => { setViewingCoffee(null); setEditingCoffee(c); }}
          onArchive={(id) => { archiveCoffee(id); setViewingCoffee(null); }}
        />
      )}

      {/* Duplicate Detection Modal */}
      {showDuplicateModal && duplicateMatch && (
        <DuplicateDetectionModal
          matchedCoffee={duplicateMatch.match}
          newCoffee={pendingCoffeeData}
          onAddPortions={handleMergePortions}
          onCopyRecipe={handleCopyRecipe}
          onStartFresh={handleStartFresh}
          onClose={closeDuplicateModal}
        />
      )}
    </>
  );
}

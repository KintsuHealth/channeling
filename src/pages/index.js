import { useState, useRef, useCallback, useMemo } from "react";
import Head from "next/head";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { optimizePortions, parseGrams, DEFAULT_DOSE_G } from "@/lib/portions";

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

function PortionPlanPreview({ plan }) {
  if (!plan?.portions?.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--ice)", marginBottom: 8 }}>Portion Plan</div>
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
      <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 500 }}>{plan.summary}</div>
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

function EspressoRecipe({ recipe, onChange }) {
  const [editing, setEditing] = useState(false);
  const [tempUnit, setTempUnit] = useState("C");
  const [loc, setLoc] = useState(recipe || { dose: "", yield: "", preInfuse: "", brewTime: "", totalTime: "", grind: "", feedSpeed: "", temp: "", notes: "" });
  const save = () => { onChange({ ...loc, tempUnit }); setEditing(false); };
  const has = recipe && (recipe.dose || recipe.yield || recipe.totalTime || recipe.grind);

  const inputStyle = { width: "100%", padding: "5px 6px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12, background: "#fff", color: "var(--text)", fontFamily: "'DM Mono', monospace" };
  const labelStyle = { fontSize: 9, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 2 };
  const sectionStyle = { marginBottom: 10, padding: "8px", background: "#fff", borderRadius: 6, border: "1px solid var(--border)" };
  const sectionTitleStyle = { fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", marginBottom: 6 };

  if (!editing && !has) return (
    <button onClick={(e) => { e.stopPropagation(); setEditing(true); }} style={{ marginTop: 8, padding: "6px 12px", background: "none", border: "1px dashed var(--border)", borderRadius: 6, fontSize: 11, color: "var(--muted)", width: "100%", textAlign: "left" }}>+ Espresso recipe</button>
  );

  if (editing) return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10, padding: 12, background: "#FAF7F4", borderRadius: 8, border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", marginBottom: 10 }}>Espresso Recipe</div>

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
        <div style={sectionTitleStyle}>⏱ Time</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <div>
            <label style={labelStyle}>Pre-infusion (s)</label>
            <input value={loc.preInfuse || ""} onChange={(e) => setLoc({ ...loc, preInfuse: e.target.value })} placeholder="5" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Brew (s)</label>
            <input value={loc.brewTime || ""} onChange={(e) => setLoc({ ...loc, brewTime: e.target.value })} placeholder="23" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Total (s)</label>
            <input value={loc.totalTime || ""} onChange={(e) => setLoc({ ...loc, totalTime: e.target.value })} placeholder="28" style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Grinder Section */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>⚙ Grinder</div>
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
        <div style={sectionTitleStyle}>🌡 Temperature</div>
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

  // Display existing recipe - make it prominent
  return (
    <div onClick={(e) => { e.stopPropagation(); setEditing(true); }} style={{ marginTop: 10, padding: 12, background: "linear-gradient(135deg, #FDF8F4 0%, #FAF0E6 100%)", borderRadius: 8, border: "2px solid var(--accent-light, #E8D5C4)", cursor: "pointer", boxShadow: "0 2px 8px rgba(92,45,14,0.08)" }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", marginBottom: 6 }}>☕ Saved Recipe — tap to edit</div>
      <div style={{ display: "flex", gap: 10, fontSize: 13, fontFamily: "'DM Mono', monospace", flexWrap: "wrap", color: "var(--text)", fontWeight: 500 }}>
        {recipe.dose && <span>{recipe.dose}g →</span>}
        {recipe.yield && <span>{recipe.yield}g</span>}
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 11, fontFamily: "'DM Mono', monospace", flexWrap: "wrap", color: "var(--muted)", marginTop: 4 }}>
        {recipe.totalTime && <span>⏱ {recipe.totalTime}s{recipe.preInfuse ? ` (pre:${recipe.preInfuse}s)` : ""}{recipe.brewTime ? ` (brew:${recipe.brewTime}s)` : ""}</span>}
        {recipe.grind && <span>⚙ @{recipe.grind}{recipe.feedSpeed ? ` · ${recipe.feedSpeed}` : ""}</span>}
        {recipe.temp && <span>🌡 {recipe.temp}°{recipe.tempUnit || "C"}</span>}
      </div>
      {recipe.notes && <div style={{ marginTop: 6, fontSize: 11, color: "var(--muted)", fontStyle: "italic", borderTop: "1px solid var(--border)", paddingTop: 6 }}>"{recipe.notes}"</div>}
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

const EMPTY = { name: "", country: "", region: "", variety: "", producer: "", roaster: "", roastLevel: "", process: "", altitude: "", weight: "", price: "", tastingNotes: "", roastDate: "" };

const COMMON_WEIGHTS = ["250", "300", "340", "500", "1000"];

function EditableResult({ data, onChange, onSubmit, onCancel, doseG, setDoseG }) {
  const [f, setF] = useState({ ...EMPTY, ...data });
  const [manualWeight, setManualWeight] = useState(false);
  const set = (k, v) => {
    const updated = { ...f, [k]: v };
    setF(updated);
    onChange(updated);
  };
  const grams = parseGrams(f.weight);
  const plan = optimizePortions(grams, doseG);

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
      {grams > 0 && <PortionPlanPreview plan={plan} />}
      {f.roastDate && (() => {
        const roast = new Date(f.roastDate);
        const freezeDate = new Date(roast.getTime() + 14 * 86400000);
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
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={(e) => { e.stopPropagation(); if (f.name && grams > 0) onSubmit(f); }}
          style={{ flex: 1, padding: "9px 0", background: f.name && grams > 0 ? "var(--accent-dark)" : "var(--border)", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600 }}>Add to Freezer</button>
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

// ─── Main ───
export default function Home() {
  const [coffees, setCoffees, loaded] = useLocalStorage("coffee-inv", []);
  const [doseG, setDoseG] = useLocalStorage("coffee-dose", DEFAULT_DOSE_G);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [pendingRating, setPendingRating] = useState(0);
  const [view, setView] = useState("morning");
  const [expanded, setExpanded] = useState(null);
  const fileRef = useRef(null);

  const update = (id, patch) => setCoffees((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const del = (id) => setCoffees((p) => p.filter((c) => c.id !== id));

  const activeCoffees = useMemo(() => coffees.filter((c) => c.status === "active").sort((a, b) => new Date(a.pulledAt) - new Date(b.pulledAt)), [coffees]);
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
  const [showAllActive, setShowAllActive] = useState(false);

  const pull = (id) => {
    setCoffees((p) => p.map((c) => {
      if (c.id === id) return { ...c, status: "active", dosesUsed: 0, pulledAt: new Date().toISOString() };
      return c;
    }));
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

  const addCoffee = (data, rating) => {
    const grams = parseGrams(data.weight);
    const plan = optimizePortions(grams, doseG);
    setCoffees((prev) => [{
      ...data, id: Date.now().toString(), addedAt: new Date().toISOString(),
      frozenAt: new Date().toISOString(), rating: rating || 0,
      gramsTotal: grams, portions: plan.portions, portionIndex: 0, dosesUsed: 0,
      status: "frozen", espresso: null, favorite: false, doseG,
      labelImage: preview, // Store the scanned label image
    }, ...prev]);
    setParsed(null); setPreview(null); setPendingRating(0); setManualMode(false); setError(null); setView("freezer");
  };

  const resetScan = () => { setParsed(null); setPreview(null); setManualMode(false); setError(null); };
  const handleDrop = useCallback((e) => { e.preventDefault(); handleFile(e.dataTransfer?.files?.[0]); }, [handleFile]);
  const rp = (c) => c.portions.length - c.portionIndex;
  const rg = (c) => c.portions.slice(c.portionIndex).reduce((s, p) => s + p.grams, 0);
  const curP = (c) => c.portions[c.portionIndex];

  const nav = [
    { key: "morning", icon: "☀", label: "Now" },
    { key: "freezer", icon: "❄", label: "Freezer" },
    { key: "scan", icon: "📷", label: "Scan" },
    { key: "archive", icon: "📋", label: "Archive" },
  ];

  if (!loaded) return null;

  return (
    <>
      <Head>
        <title>Coffee Inventory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#F5F0EB" />
      </Head>

      <div style={{ minHeight: "100vh", paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ padding: "24px 20px 14px", background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 22 }}>☕</span>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 22, fontWeight: 700, margin: 0, color: "var(--accent-dark)" }}>Coffee Inventory</h1>
          </div>
          <div style={{ marginTop: 5, fontSize: 11, color: "var(--muted)" }}>
            {totalFrozenGrams > 0 ? `${totalFrozenGrams}g · ${totalFrozenDoses} doses across ${frozen.length} bag${frozen.length !== 1 ? "s" : ""} in freezer` : active ? "Freezer empty — active bag only" : "No coffee tracked yet"}
          </div>
        </div>

        <div style={{ maxWidth: 540, margin: "0 auto", padding: "16px 16px 0" }}>

          {/* ─── MORNING ─── */}
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
                            {active.labelImage && <LabelThumbnail src={active.labelImage} size={64} />}
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
                        <EspressoRecipe recipe={active.espresso} onChange={(esp) => update(active.id, { espresso: esp })} />
                        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                          <button onClick={() => finishPortion(active)} style={{ flex: 1, padding: "9px 0", background: "var(--accent-dark)", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600 }}>
                            {more > 0 ? "Portion done → freezer" : "Bag finished"}
                          </button>
                          <button onClick={() => update(active.id, { status: "frozen" })} style={{ padding: "9px 12px", background: "none", border: "1px solid var(--ice)", color: "var(--ice)", borderRadius: 7, fontSize: 12 }} title="Put back in freezer">❄</button>
                          <button onClick={() => del(active.id)} style={{ padding: "9px 12px", background: "none", border: "1px solid var(--error)", color: "var(--error)", borderRadius: 7, fontSize: 12 }} title="Delete">✕</button>
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
                        {c.labelImage && <LabelThumbnail src={c.labelImage} size={44} />}
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
                          {(c.espresso.totalTime || c.espresso.time) && <span>⏱{c.espresso.totalTime || c.espresso.time}s </span>}
                          {c.espresso.grind && <span>⚙@{c.espresso.grind} </span>}
                          {c.espresso.feedSpeed && <span>{c.espresso.feedSpeed} </span>}
                          {c.espresso.temp && <span>🌡{c.espresso.temp}°{c.espresso.tempUnit || ""}</span>}
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
            return (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--ice)", marginBottom: 12 }}>❄ Freezer — {totalFrozenGrams}g · {totalFrozenDoses} doses</div>
              {allFreezerItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)", fontSize: 13 }}>Freezer empty.<br /><button onClick={() => setView("scan")} style={{ marginTop: 12, padding: "8px 20px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600 }}>Scan a bag</button></div>
              ) : allFreezerItems.map((c) => {
                const isExp = expanded === c.id;
                return (
                  <div key={c.id} onClick={() => setExpanded(isExp ? null : c.id)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 10, cursor: "pointer", boxShadow: isExp ? "0 3px 16px rgba(92,45,14,0.06)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      {c.labelImage && <LabelThumbnail src={c.labelImage} size={56} />}
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
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ice)" }}>{c.isActiveRemaining ? c.portions.slice(c.portionIndex + 1).reduce((s, p) => s + p.grams, 0) : rg(c)}g</div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>{c.isActiveRemaining ? c.portions.length - c.portionIndex - 1 : rp(c)} portion{(c.isActiveRemaining ? c.portions.length - c.portionIndex - 1 : rp(c)) !== 1 ? "s" : ""}</div>
                        {c.isActiveRemaining && <div style={{ fontSize: 10, color: "var(--active)", fontWeight: 600, marginTop: 2 }}>● 1 active</div>}
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
                        {c.labelImage && (
                          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
                            <LabelThumbnail src={c.labelImage} size={120} />
                          </div>
                        )}
                        {c.espresso && (c.espresso.dose || c.espresso.yield || c.espresso.totalTime || c.espresso.time || c.espresso.grind) && (
                          <div style={{ marginBottom: 10, padding: "10px 12px", background: "linear-gradient(135deg, #FDF8F4 0%, #FAF0E6 100%)", border: "1.5px solid var(--accent-light, #E8D5C4)", borderRadius: 8, boxShadow: "0 2px 6px rgba(92,45,14,0.06)" }}>
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", marginBottom: 6 }}>☕ Espresso Recipe</div>
                            <div style={{ display: "flex", gap: 10, fontSize: 13, fontFamily: "'DM Mono', monospace", flexWrap: "wrap", color: "var(--text)", fontWeight: 500 }}>
                              {c.espresso.dose && <span>{c.espresso.dose}g →</span>}
                              {c.espresso.yield && <span>{c.espresso.yield}g</span>}
                            </div>
                            <div style={{ display: "flex", gap: 12, fontSize: 11, fontFamily: "'DM Mono', monospace", flexWrap: "wrap", color: "var(--muted)", marginTop: 4 }}>
                              {(c.espresso.totalTime || c.espresso.time) && <span>⏱ {c.espresso.totalTime || c.espresso.time}s{c.espresso.preInfuse ? ` (pre:${c.espresso.preInfuse}s)` : ""}{c.espresso.brewTime ? ` (brew:${c.espresso.brewTime}s)` : ""}</span>}
                              {c.espresso.grind && <span>⚙ @{c.espresso.grind}{c.espresso.feedSpeed ? ` · ${c.espresso.feedSpeed}` : ""}</span>}
                              {c.espresso.temp && <span>🌡 {c.espresso.temp}°{c.espresso.tempUnit || "C"}</span>}
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
                          <button onClick={(e) => { e.stopPropagation(); update(c.id, { favorite: !c.favorite }); }} style={{ padding: "8px 14px", background: "none", border: `1px solid ${c.favorite ? "var(--star)" : "var(--border)"}`, color: c.favorite ? "var(--star)" : "var(--muted)", borderRadius: 7, fontSize: 12, fontWeight: 600 }}>{c.favorite ? "★" : "☆"}</button>
                          <button onClick={(e) => { e.stopPropagation(); del(c.id); }} style={{ padding: "8px 14px", background: "none", border: "1px solid var(--error)", color: "var(--error)", borderRadius: 7, fontSize: 12 }}>✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );})()}

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
                    <div style={{ fontSize: 32, marginBottom: 6, opacity: 0.7 }}>📷</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)", marginBottom: 3 }}>Snap or drop a coffee bag</div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>Auto-parsed → optimally portioned → frozen</div>
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                      <button onClick={(e) => { e.stopPropagation(); setManualMode(true); }} style={{ padding: "6px 16px", background: "none", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, color: "var(--muted)" }}>Or enter manually</button>
                    </div>
                  </>
                )}

                {manualMode && !parsed && <ManualEntry onSubmit={(d) => { setParsed(d); setManualMode(false); }} onCancel={resetScan} />}

                {parsed && <EditableResult data={parsed} onChange={setParsed} onSubmit={(data) => addCoffee(data, 0)} onCancel={resetScan} doseG={doseG} setDoseG={setDoseG} />}
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
                <div key={c.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        {c.name || "Unnamed"} {c.favorite && <span style={{ color: "var(--star)", fontSize: 12 }}>★</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.country}{c.variety ? ` · ${c.variety}` : ""} · {c.gramsTotal}g · {fmtFull(c.addedAt)}</div>
                      <Stars value={c.rating || 0} size={12} />
                    </div>
                    <button onClick={() => del(c.id)} style={{ padding: "5px 10px", background: "none", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 5, fontSize: 11 }}>✕</button>
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
    </>
  );
}

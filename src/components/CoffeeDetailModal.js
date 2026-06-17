import { useState } from "react";
import { getRecipes } from "../lib/recipes";
import { DialInModal } from "./DialInModal";

function LabelCard({ coffee, size = "large" }) {
  const bgColor = coffee.bagColor || "#6B4423";

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

  const COUNTRY_CODES = {
    "colombia": "COL", "brazil": "BRA", "ethiopia": "ETH", "kenya": "KEN", "guatemala": "GUA",
    "costa rica": "CRI", "panama": "PAN", "honduras": "HON", "el salvador": "SLV", "peru": "PER",
    "mexico": "MEX", "nicaragua": "NIC", "rwanda": "RWA", "burundi": "BDI", "indonesia": "IDN",
  };
  const getCountryCode = (country) => {
    if (!country) return null;
    const lower = country.toLowerCase();
    return COUNTRY_CODES[lower] || country.slice(0, 3).toUpperCase();
  };

  const countryCode = getCountryCode(coffee.country);
  const tags = [countryCode, coffee.variety, coffee.process].filter(Boolean);

  return (
    <div
      style={{
        width: 180,
        height: 200,
        background: `linear-gradient(145deg, ${bgColor} 0%, ${bgColor}ee 100%)`,
        borderRadius: 16,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxShadow: "0 4px 14px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.12)",
        border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
        flexShrink: 0,
      }}
    >
      {coffee.roaster && (
        <div style={{
          fontSize: 9,
          fontWeight: 600,
          color: secondary,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          textAlign: "center",
        }}>
          {coffee.roaster}
        </div>
      )}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          fontSize: 18,
          fontWeight: 700,
          color: primary,
          lineHeight: 1.2,
          fontFamily: "'Playfair Display', Georgia, serif",
          textAlign: "center",
        }}>
          {coffee.name || "Unnamed"}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
        {tags.map((tag, i) => (
          <span key={i} style={{
            fontSize: 9,
            fontWeight: 500,
            color: primary,
            background: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
            padding: "2px 10px",
            borderRadius: 4,
            textTransform: "uppercase",
          }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stars({ value, size = 16 }) {
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ fontSize: size, lineHeight: 1, color: s <= value ? "var(--star)" : "var(--star-off)" }}>
          ●
        </span>
      ))}
    </div>
  );
}

const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;

const STATUS_LABELS = {
  resting: { label: "Resting", color: "var(--accent)", icon: "○" },
  frozen: { label: "In Freezer", color: "var(--ice)", icon: "❄" },
  active: { label: "Active", color: "var(--active)", icon: "●" },
  done: { label: "Archived", color: "var(--done)", icon: "✓" },
};

export function CoffeeDetailModal({ coffee, onClose, onEdit, onArchive, onUpdate, baseline, allCoffees }) {
  const [showDialIn, setShowDialIn] = useState(false);
  if (!coffee) return null;

  const status = STATUS_LABELS[coffee.status] || STATUS_LABELS.frozen;

  const details = [
    ["Roaster", coffee.roaster],
    ["Producer", coffee.producer],
    ["Country", coffee.country],
    ["Region", coffee.region],
    ["Variety", coffee.variety],
    ["Process", coffee.process],
    ["Roast Level", coffee.roastLevel],
    ["Altitude", coffee.altitude],
    ["Price", coffee.price],
    ["Weight", coffee.weight],
  ].filter(([, v]) => v);

  const dates = [
    ["Roast Date", fmt(coffee.roastDate)],
    ["Added", fmt(coffee.addedAt)],
    ["Frozen", fmt(coffee.frozenAt)],
    ["Pulled", fmt(coffee.pulledAt)],
    ["Rested", coffee.daysRested ? `${coffee.daysRested} days` : null],
    ["Finished", fmt(coffee.finishedAt)],
  ].filter(([, v]) => v);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg)",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 540,
          maxHeight: "90vh",
          overflow: "auto",
          padding: "24px 20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: status.color, fontSize: 16 }}>{status.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: status.color, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {status.label}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 28,
              color: "var(--muted)",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Label Card and Image */}
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 24 }}>
          {coffee.bagColor && <LabelCard coffee={coffee} />}
          {coffee.labelImage && (
            <div style={{
              width: coffee.bagColor ? 120 : 180,
              height: 200,
              borderRadius: 12,
              overflow: "hidden",
              border: "1.5px solid var(--border)",
            }}>
              <img src={coffee.labelImage} alt="Label" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}
        </div>

        {/* Name */}
        <h2 style={{
          margin: "0 0 8px 0",
          fontSize: 24,
          fontFamily: "'Playfair Display', serif",
          textAlign: "center",
        }}>
          {coffee.name || "Unnamed"}
          {coffee.favorite && <span style={{ color: "var(--star)", marginLeft: 8 }}>★</span>}
        </h2>

        {/* Rating */}
        {coffee.rating > 0 && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <Stars value={coffee.rating} size={18} />
          </div>
        )}

        {/* Tasting Notes */}
        {coffee.tastingNotes && (
          <div style={{
            padding: "12px 16px",
            background: "var(--accent-light)",
            borderRadius: 10,
            marginBottom: 20,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", marginBottom: 4 }}>
              Tasting Notes
            </div>
            <div style={{ fontSize: 14, fontStyle: "italic", color: "var(--text)" }}>
              "{coffee.tastingNotes}"
            </div>
          </div>
        )}

        {/* Details Grid */}
        {details.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)", marginBottom: 10 }}>
              Details
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {details.map(([label, value]) => (
                <div key={label} style={{ padding: "10px 12px", background: "var(--card)", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dates */}
        {dates.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)", marginBottom: 10 }}>
              Timeline
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {dates.map(([label, value]) => (
                <div key={label} style={{
                  padding: "6px 12px",
                  background: "var(--card)",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                }}>
                  <span style={{ color: "var(--muted)" }}>{label}:</span>{" "}
                  <span style={{ fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recipes */}
        {(() => {
          const recipes = getRecipes(coffee).filter((r) => r.dose || r.grind || r.yield || r.totalTime || r.time);
          if (recipes.length === 0) return null;
          return (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)", marginBottom: 10 }}>
                {recipes.length > 1 ? "Recipes" : "Espresso Recipe"}
              </div>
              {recipes.map((r, ri) => (
                <div key={r.id || ri} style={{
                  padding: "14px 16px",
                  marginBottom: ri < recipes.length - 1 ? 10 : 0,
                  background: "linear-gradient(135deg, #FDF8F4 0%, #FAF0E6 100%)",
                  border: "1.5px solid var(--accent-light)",
                  borderRadius: 10,
                }}>
                  {recipes.length > 1 && (
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-dark)", marginBottom: 8 }}>{r.name || `Recipe ${ri + 1}`}</div>
                  )}
                  <div style={{ display: "flex", gap: 16, fontSize: 16, fontFamily: "'DM Mono', monospace", fontWeight: 600, marginBottom: 8 }}>
                    {r.dose && <span>{r.dose}g in</span>}
                    {r.yield && <span>→ {r.yield}g out</span>}
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 13, fontFamily: "'DM Mono', monospace", color: "var(--muted)" }}>
                    {(r.totalTime || r.time) && <span>{r.totalTime || r.time}s</span>}
                    {r.grind && <span>@{r.grind}</span>}
                    {r.temp && <span>{r.temp}°{r.tempUnit || "C"}</span>}
                  </div>
                  {r.notes && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)", fontSize: 12, fontStyle: "italic" }}>
                      "{r.notes}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Dial-in insight */}
        {coffee.dialInNotes && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)", marginBottom: 10 }}>
              🤖 Dial-in insight
            </div>
            <div style={{ padding: "12px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12.5, lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap" }}>
              {coffee.dialInNotes}
            </div>
          </div>
        )}

        {/* Portions */}
        {coffee.portions && coffee.portions.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted)", marginBottom: 10 }}>
              Portions ({coffee.gramsTotal}g total)
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {coffee.portions.map((p, i) => {
                const used = i < coffee.portionIndex;
                const isCurrent = i === coffee.portionIndex && coffee.status === 'active';
                return (
                  <div key={i} style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    background: used ? "#EDEAE7" : isCurrent ? "var(--active-bg)" : "var(--ice-bg)",
                    border: `1px solid ${used ? "#D5CEC6" : isCurrent ? "var(--active)" : "var(--ice)"}`,
                    color: used ? "#A09890" : isCurrent ? "var(--active)" : "var(--ice)",
                    textDecoration: used ? "line-through" : "none",
                  }}>
                    {p.grams}g · {p.doses}d{p.buffer > 0 && !used ? ` +${p.buffer}` : ""}{isCurrent ? " ●" : ""}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Dial-In */}
        {onUpdate && (
          <button
            onClick={() => setShowDialIn(true)}
            style={{
              width: "100%", marginTop: 20, padding: "13px",
              background: "linear-gradient(135deg, #FDF8F4 0%, #FAF0E6 100%)",
              border: "1.5px solid var(--accent)", borderRadius: 10,
              fontSize: 14, fontWeight: 700, color: "var(--accent-dark)", cursor: "pointer",
            }}
          >
            🤖 Dial in this coffee
          </button>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "14px",
              background: "none",
              border: "1.5px solid var(--border)",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            Close
          </button>
          {onEdit && (
            <button
              onClick={() => { onClose(); onEdit(coffee); }}
              style={{
                flex: 1,
                padding: "14px",
                background: "var(--accent)",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Edit
            </button>
          )}
          {onArchive && coffee.status !== 'done' && (
            <button
              onClick={() => { onArchive(coffee.id); onClose(); }}
              style={{
                flex: 1,
                padding: "14px",
                background: "var(--done)",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {showDialIn && (
        <DialInModal
          key={coffee.id}
          coffee={coffee}
          baseline={baseline}
          allCoffees={allCoffees}
          onApply={(newRecs, insight) => onUpdate(coffee.id, { recipes: [...getRecipes(coffee), ...newRecs], espresso: null, dialInNotes: insight })}
          onClose={() => setShowDialIn(false)}
        />
      )}
    </div>
  );
}

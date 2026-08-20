// Overview component
import { getRecipes } from "../lib/recipes";
import LatteArtStrip from "./LatteArtStrip";

// ─── Country Codes ───
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

// ─── Label Card (matches index.js) ───
function LabelCard({ coffee, size = "medium" }) {
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
  const sizes = {
    small: { width: 90, height: 110, nameSize: 11, tagSize: 7, roasterSize: 6, padding: 8, gap: 3 },
    medium: { width: 115, height: 135, nameSize: 13, tagSize: 8, roasterSize: 7, padding: 10, gap: 3 },
    large: { width: 155, height: 175, nameSize: 16, tagSize: 9, roasterSize: 8, padding: 14, gap: 4 },
  };
  const s = sizes[size] || sizes.medium;
  const countryCode = getCountryCode(coffee.country);
  const tags = [countryCode, coffee.variety, coffee.process].filter(Boolean);

  return (
    <div style={{
      width: s.width, height: s.height,
      background: `linear-gradient(145deg, ${bgColor} 0%, ${bgColor}ee 100%)`,
      borderRadius: 12, padding: s.padding,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      boxShadow: "0 4px 14px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.12)",
      border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
      flexShrink: 0, overflow: "hidden",
    }}>
      {coffee.roaster && (
        <div style={{ fontSize: s.roasterSize, fontWeight: 600, color: secondary, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {coffee.roaster.length > 14 ? coffee.roaster.slice(0, 13) + "…" : coffee.roaster}
        </div>
      )}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 0" }}>
        <div style={{ fontSize: s.nameSize, fontWeight: 700, color: primary, lineHeight: 1.2, fontFamily: "'Noto Sans JP', sans-serif", textAlign: "center", wordBreak: "break-word" }}>
          {coffee.name || "Unnamed"}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: s.gap, alignItems: "center" }}>
        {tags.map((tag, i) => (
          <span key={i} style={{ fontSize: s.tagSize, fontWeight: 500, color: primary, background: dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)", padding: "2px 8px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.3px", whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Label Thumbnail ───
function LabelThumbnail({ src, size = 48 }) {
  if (!src) return null;
  return (
    <div style={{ width: size, height: size, borderRadius: 6, overflow: "hidden", border: "1.5px solid var(--border)", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
      <img src={src} alt="Coffee label" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

// ─── Reusable Components ───

function StatCard({ value, label, color, small }) {
  return (
    <div style={{
      flex: 1,
      textAlign: "center",
      padding: small ? "8px 4px" : "12px 8px",
      background: "var(--card)",
      borderRadius: 8,
      border: "1px solid var(--border)",
    }}>
      <div style={{
        fontSize: small ? 18 : 22,
        fontWeight: 700,
        color: color || "var(--text)",
        fontFamily: "'Noto Sans Mono', monospace",
      }}>
        {value}
      </div>
      <div style={{
        fontSize: small ? 9 : 10,
        color: "var(--muted)",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        marginTop: 2,
      }}>
        {label}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, color }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "1.5px",
      color: color || "var(--muted)",
      marginBottom: 10,
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}>
      {icon && <span>{icon}</span>}
      {title}
    </div>
  );
}

function ProgressBar({ percent, color }) {
  return (
    <div style={{
      flex: 1,
      height: 8,
      background: "#EDE8E2",
      borderRadius: 4,
      overflow: "hidden",
    }}>
      <div style={{
        height: "100%",
        width: `${Math.min(100, Math.max(0, percent))}%`,
        background: color || "var(--accent)",
        borderRadius: 4,
        transition: "width 0.3s",
      }} />
    </div>
  );
}

function Stars({ value, size = 14 }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= value ? "var(--star)" : "var(--star-off)" }}>
          ●
        </span>
      ))}
    </span>
  );
}

// ─── Now Brewing Section ───

function NowBrewing({ coffee, onUseDose, onPull, recipeSlot }) {
  if (!coffee) {
    return (
      <div style={{
        background: "var(--card)",
        border: "1.5px dashed var(--border)",
        borderRadius: 10,
        padding: "28px 18px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }}>●</div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>
          No active coffee
        </div>
        <button
          onClick={onPull}
          style={{
            padding: "8px 20px",
            background: "var(--ice)",
            color: "#fff",
            border: "none",
            borderRadius: 7,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Pull from freezer
        </button>
      </div>
    );
  }

  const { name, roaster, country, region, variety, process, roastLevel, altitude, tastingNotes, dosesLeft, gramsLeft, daysSincePulled, remainingPortions, isStale, bagColor, labelImage } = coffee;

  const chips = [
    country && region ? `${region}, ${country}` : country || region,
    variety,
    process,
    roastLevel && `${roastLevel} roast`,
    altitude,
  ].filter(Boolean);

  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      padding: "18px",
      boxShadow: "var(--shadow-md)",
    }}>
      <div style={{ display: "flex", gap: 14 }}>
        {/* Label Card or Thumbnail */}
        {bagColor ? (
          <LabelCard coffee={coffee} size="medium" />
        ) : labelImage ? (
          <LabelThumbnail src={labelImage} size={96} />
        ) : (
          <div style={{
            width: 90, height: 110,
            background: "linear-gradient(145deg, #F5EDE5, #E8DFD5)",
            borderRadius: 10, border: "1px solid var(--border)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: 8, textAlign: "center", flexShrink: 0,
          }}>
            <div style={{ fontSize: 18, marginBottom: 4, color: "var(--accent)" }}>●</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--accent-dark)", textTransform: "uppercase", lineHeight: 1.2 }}>
              {country || "Coffee"}
            </div>
          </div>
        )}

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {roaster && (
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 2 }}>
              {roaster}
            </div>
          )}
          <div style={{
            fontSize: 19,
            fontWeight: 800,
            marginBottom: 6,
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
          }}>
            {name || "Unnamed Coffee"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
            {chips.map((c, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 600, padding: "3px 8px", background: "var(--tag)", color: "var(--accent-dark)", borderRadius: 6 }}>
                {c}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {dosesLeft} dose{dosesLeft !== 1 ? "s" : ""} left · ~{gramsLeft}g
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px",
              background: isStale ? "rgba(180,85,45,0.1)" : "var(--ice-bg)",
              borderRadius: 6, fontSize: 10.5, fontWeight: 600,
              color: isStale ? "var(--error)" : "var(--ice)",
            }}>
              Day {daysSincePulled} of thaw{isStale && " !"}
            </span>
            {remainingPortions > 0 && (
              <span style={{ fontSize: 10.5, color: "var(--ice)", fontWeight: 600 }}>
                +{remainingPortions} portion{remainingPortions !== 1 ? "s" : ""} frozen
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tasting notes — the reason you bought the bag, front and center */}
      {tastingNotes && (
        <div style={{
          marginTop: 12, padding: "10px 14px",
          background: "var(--bg)", borderLeft: "3px solid var(--accent)",
          borderRadius: "4px 10px 10px 4px",
          fontSize: 12.5, lineHeight: 1.6, color: "var(--accent-dark)", fontStyle: "italic",
        }}>
          “{tastingNotes}”
        </div>
      )}

      {/* Recipe(s) for the bag being brewed — editable manager when provided,
          otherwise a read-only summary. */}
      {recipeSlot ? (
        <div style={{ marginTop: 14 }}>{recipeSlot}</div>
      ) : (() => {
        const recipes = getRecipes(coffee).filter((r) => r.grind || r.dose || r.yield || r.totalTime || r.time);
        if (recipes.length === 0) return null;
        return (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {recipes.map((r, i) => (
              <div key={r.id || i} style={{
                padding: "10px 12px",
                background: "linear-gradient(135deg, #FDF8F4 0%, #FAF0E6 100%)",
                border: "1.5px solid var(--accent-light)",
                borderRadius: 8,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)" }}>
                    ● {recipes.length > 1 ? (r.name || `Recipe ${i + 1}`) : "Recipe"}
                  </span>
                  {r.grind && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", background: "var(--accent-dark)", borderRadius: 5 }}>
                      <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Grind</span>
                      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Noto Sans Mono', monospace", color: "#fff" }}>{r.grind}</span>
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6, fontSize: 12, fontFamily: "'Noto Sans Mono', monospace", color: "var(--text)" }}>
                  {(r.dose || r.yield) && <span>{r.dose || "—"}g → {r.yield || "—"}g</span>}
                  {(r.totalTime || r.time) && <span>{r.totalTime || r.time}s</span>}
                  {r.temp && <span>{r.temp}°{r.tempUnit || "C"}</span>}
                  {r.feedSpeed && <span style={{ textTransform: "capitalize" }}>{r.feedSpeed}</span>}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Quick Use Dose Button */}
      <button
        onClick={onUseDose}
        style={{
          marginTop: 14,
          width: "100%",
          padding: "10px 0",
          background: "var(--accent-dark)",
          color: "#fff",
          border: "none",
          borderRadius: 7,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Use Dose ({dosesLeft} remaining)
      </button>
    </div>
  );
}

// ─── Freezer Stats Section ───

function FreezerStats({ grams, portions, doses }) {
  // Calculate days at different consumption rates
  const daysAt1 = doses;
  const daysAt2 = Math.floor(doses / 2);
  const daysAt3 = Math.floor(doses / 3);

  return (
    <div>
      <SectionHeader icon="❄" title="Freezer Stats" color="var(--ice)" />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <StatCard value={`${grams}g`} label="total" color="var(--ice)" />
        <StatCard value={portions} label={portions === 1 ? "portion" : "portions"} color="var(--ice)" />
        <StatCard value={doses} label="doses" color="var(--ice)" />
      </div>
      {doses > 0 && (
        <div style={{
          fontSize: 11,
          color: "var(--muted)",
          padding: "10px 12px",
          background: "var(--card)",
          borderRadius: 6,
          border: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-around",
          gap: 8,
        }}>
          <span>☕ <strong>{daysAt1}d</strong></span>
          <span style={{ color: "var(--border)" }}>|</span>
          <span>☕☕ <strong>{daysAt2}d</strong></span>
          <span style={{ color: "var(--border)" }}>|</span>
          <span>☕☕☕ <strong>{daysAt3}d</strong></span>
        </div>
      )}
    </div>
  );
}

// ─── Consumption Stats Section ───

function ConsumptionStats({ consumed, finished, doses, avgRating }) {
  const formatGrams = (g) => {
    if (g >= 1000) return `${(g / 1000).toFixed(1)}kg`;
    return `${g}g`;
  };

  return (
    <div>
      <SectionHeader icon="≡" title="All Time" color="var(--accent)" />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <StatCard value={formatGrams(consumed)} label="consumed" />
        <StatCard value={finished} label={finished === 1 ? "bag" : "bags"} />
        <StatCard value={doses} label="shots" />
      </div>
      {avgRating > 0 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "8px 12px",
          background: "var(--card)",
          borderRadius: 6,
          border: "1px solid var(--border)",
        }}>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>Avg rating:</span>
          <Stars value={Math.round(avgRating)} size={12} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>({avgRating.toFixed(1)})</span>
        </div>
      )}
    </div>
  );
}

// ─── Favorites Section ───

function Favorites({ topRated, topRoasters, topCountries }) {
  if (topRated.length === 0 && topRoasters.length === 0 && topCountries.length === 0) {
    return null;
  }

  return (
    <div>
      <SectionHeader icon="★" title="Favorites" color="var(--star)" />
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 14px",
      }}>
        {topRated.length > 0 && (
          <div style={{ marginBottom: topRoasters.length > 0 || topCountries.length > 0 ? 10 : 0 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>TOP RATED</div>
            {topRated.map((c, i) => (
              <div key={c.id} style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 0",
              }}>
                <span style={{ fontSize: 12 }}>{c.name}</span>
                <Stars value={c.rating} size={10} />
              </div>
            ))}
          </div>
        )}

        {topRoasters.length > 0 && (
          <div style={{ marginBottom: topCountries.length > 0 ? 10 : 0 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>TOP ROASTERS</div>
            {topRoasters.map((r, i) => (
              <div key={r.name} style={{ fontSize: 12, padding: "2px 0" }}>
                {r.name} <span style={{ color: "var(--muted)" }}>({r.count} bag{r.count !== 1 ? "s" : ""})</span>
              </div>
            ))}
          </div>
        )}

        {topCountries.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>TOP ORIGINS</div>
            {topCountries.map((c, i) => (
              <div key={c.name} style={{ fontSize: 12, padding: "2px 0" }}>
                {c.name} <span style={{ color: "var(--muted)" }}>({c.count} bag{c.count !== 1 ? "s" : ""})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Breakdown Section ───

function BreakdownChart({ icon, title, data, color }) {
  if (!data || data.length === 0) return null;

  const colors = [
    "var(--accent)",
    "var(--ice)",
    "var(--active)",
    "#8B7355",
    "#6B8E6B",
    "#A0A0A0",
  ];

  return (
    <div>
      <SectionHeader icon={icon} title={title} />
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 14px",
      }}>
        {data.map((item, i) => (
          <div key={item.name} style={{ marginBottom: i < data.length - 1 ? 10 : 0 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 4,
            }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{item.name}</span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{item.percent}%</span>
            </div>
            <ProgressBar percent={item.percent} color={colors[i % colors.length]} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Resting Section ───

function RestingSection({ restingCoffees, readyToFreezeCount, onViewResting }) {
  if (!restingCoffees || restingCoffees.length === 0) return null;

  return (
    <div>
      <SectionHeader icon="○" title="Resting" color="var(--accent)" />
      <div style={{
        background: readyToFreezeCount > 0 ? "rgba(76, 175, 80, 0.08)" : "var(--card)",
        border: `1px solid ${readyToFreezeCount > 0 ? "var(--success)" : "var(--border)"}`,
        borderRadius: 10,
        padding: "12px 14px",
      }}>
        {readyToFreezeCount > 0 && (
          <div style={{
            padding: "8px 12px",
            background: "rgba(76, 175, 80, 0.15)",
            borderRadius: 6,
            marginBottom: 10,
            textAlign: "center",
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success)" }}>
              {readyToFreezeCount} coffee{readyToFreezeCount !== 1 ? "s" : ""} ready to freeze!
            </span>
          </div>
        )}

        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
          {restingCoffees.length} bag{restingCoffees.length !== 1 ? "s" : ""} degassing
        </div>

        {/* Mini list of resting coffees */}
        {restingCoffees.slice(0, 3).map((c) => (
          <div key={c.id} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 0",
            borderBottom: "1px solid var(--border)",
          }}>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{c.name || "Unnamed"}</span>
            <span style={{
              fontSize: 11,
              color: c.isReadyToFreeze ? "var(--success)" : "var(--muted)",
              fontWeight: c.isReadyToFreeze ? 600 : 400,
            }}>
              {c.isReadyToFreeze ? "Ready!" : `${c.daysUntilFreeze}d left`}
            </span>
          </div>
        ))}

        {restingCoffees.length > 3 && (
          <div style={{ fontSize: 11, color: "var(--muted)", paddingTop: 6 }}>
            +{restingCoffees.length - 3} more
          </div>
        )}

        <button
          onClick={onViewResting}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "8px 0",
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: 11,
            color: "var(--accent)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          View all resting
        </button>
      </div>
    </div>
  );
}

// ─── Recent Activity Section ───

function RecentActivity({ recentlyAdded, lastFinished }) {
  if (recentlyAdded.length === 0) return null;

  const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  return (
    <div>
      <SectionHeader icon="○" title="Recent Activity" />
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 14px",
      }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>RECENTLY ADDED</div>
        {recentlyAdded.slice(0, 3).map((c) => (
          <div key={c.id} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 0",
            fontSize: 12,
          }}>
            <span>{c.name || "Unnamed"}</span>
            <span style={{ color: "var(--muted)", fontSize: 11 }}>{fmt(c.addedAt)}</span>
          </div>
        ))}

        {lastFinished && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>LAST FINISHED</div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 12,
            }}>
              <span>{lastFinished.name || "Unnamed"}</span>
              <span style={{ color: "var(--muted)", fontSize: 11 }}>{fmt(lastFinished.finishedAt || lastFinished.addedAt)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Grind Drift Sparkline ───
// Single series: one hue, thin 2px line, endpoint dot, no grid — the hero
// number beside it carries the value; per-point <title> gives hover detail.
function GrindSparkline({ history, width = 120, height = 36 }) {
  if (!history || history.length < 2) return null;
  const pad = 4;
  const gs = history.map((p) => p.grind);
  const min = Math.min(...gs);
  const max = Math.max(...gs);
  const span = max - min || 1;
  const x = (i) => pad + (i / (history.length - 1)) * (width - pad * 2);
  const y = (g) => height - pad - ((g - min) / span) * (height - pad * 2);
  const d = history.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.grind).toFixed(1)}`).join(" ");
  const last = history[history.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Grind drift across last ${history.length} coffees, from ${history[0].grind} to ${last.grind}`}>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(history.length - 1)} cy={y(last.grind)} r="3" fill="var(--accent-dark)" />
      {history.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.grind)} r="7" fill="transparent">
          <title>{`${p.name || "Coffee"} — @${p.grind}`}</title>
        </circle>
      ))}
    </svg>
  );
}

// ─── Main Overview Component ───

export default function Overview({ stats, onUseDose, onPullFromFreezer, onViewResting, latteArt, recipeSlot }) {
  const {
    activeCoffee,
    restingCoffees,
    restingCount,
    readyToFreezeCount,
    freezerGrams,
    freezerPortions,
    freezerDoses,
    estimatedDaysLeft,
    totalConsumed,
    totalFinished,
    totalDoses,
    avgRating,
    avgGrind,
    grindHistory,
    topRated,
    topRoasters,
    topCountries,
    byCountry,
    byVariety,
    recentlyAdded,
    lastFinished,
  } = stats;

  const isEmpty = totalFinished === 0 && freezerPortions === 0 && !activeCoffee;

  if (isEmpty) {
    return (
      <div style={{
        textAlign: "center",
        padding: "60px 20px",
        color: "var(--muted)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>●</div>
        <div style={{ fontSize: 15, marginBottom: 8 }}>Welcome to Expertso</div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          Start by scanning or adding your first coffee bag.<br />
          Your stats will appear here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Now Brewing Hero */}
      <div>
        <SectionHeader icon="●" title="Now Brewing" color="var(--active)" />
        <NowBrewing
          coffee={activeCoffee}
          onUseDose={onUseDose}
          onPull={onPullFromFreezer}
          recipeSlot={recipeSlot}
        />
      </div>

      {/* Average Grind + drift sparkline */}
      {avgGrind !== null && (
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          boxShadow: "var(--shadow-sm)",
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Grind Drift
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              {grindHistory && grindHistory.length >= 2
                ? `Last ${grindHistory.length} dial-ins · avg ${avgGrind.toFixed(1)}`
                : "Based on your dialed-in coffees"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            <GrindSparkline history={grindHistory} />
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              fontFamily: "'Noto Sans Mono', monospace",
              fontVariantNumeric: "tabular-nums",
              color: "var(--accent-dark)",
            }}>
              {grindHistory && grindHistory.length > 0
                ? grindHistory[grindHistory.length - 1].grind
                : avgGrind.toFixed(1)}
            </div>
          </div>
        </div>
      )}

      {/* Resting Section */}
      {restingCount > 0 && (
        <RestingSection
          restingCoffees={restingCoffees}
          readyToFreezeCount={readyToFreezeCount}
          onViewResting={onViewResting}
        />
      )}

      {/* Freezer Stats */}
      {freezerPortions > 0 && (
        <FreezerStats
          grams={freezerGrams}
          portions={freezerPortions}
          doses={freezerDoses}
        />
      )}

      {/* Consumption Stats */}
      {totalFinished > 0 && (
        <ConsumptionStats
          consumed={totalConsumed}
          finished={totalFinished}
          doses={totalDoses}
          avgRating={avgRating}
        />
      )}

      {/* Favorites */}
      <Favorites
        topRated={topRated}
        topRoasters={topRoasters}
        topCountries={topCountries}
      />

      {/* Origin Breakdown */}
      {byCountry.length > 0 && (
        <BreakdownChart
          icon="◯"
          title="Origins"
          data={byCountry}
        />
      )}

      {/* Variety Breakdown */}
      {byVariety.length > 0 && (
        <BreakdownChart
          icon="◦"
          title="Varieties"
          data={byVariety}
        />
      )}

      {/* Latte Art */}
      {latteArt && (
        <LatteArtStrip
          pours={latteArt.pours}
          createPour={latteArt.createPour}
          deletePour={latteArt.deletePour}
        />
      )}

      {/* Recent Activity */}
      <RecentActivity
        recentlyAdded={recentlyAdded}
        lastFinished={lastFinished}
      />
    </div>
  );
}

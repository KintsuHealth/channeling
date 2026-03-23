// Overview component - no direct dose imports needed

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
        <div style={{ fontSize: s.nameSize, fontWeight: 700, color: primary, lineHeight: 1.2, fontFamily: "'Playfair Display', Georgia, serif", textAlign: "center", wordBreak: "break-word" }}>
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
        fontFamily: "'DM Mono', monospace",
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

function NowBrewing({ coffee, onUseDose, onPull }) {
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

  const { name, country, variety, roastLevel, rating, dosesLeft, gramsLeft, daysSincePulled, remainingPortions, isStale, bagColor, labelImage } = coffee;

  return (
    <div style={{
      background: "var(--active-bg)",
      border: "1.5px solid var(--active)",
      borderRadius: 10,
      padding: "16px 18px",
    }}>
      <div style={{ display: "flex", gap: 14 }}>
        {/* Label Card or Thumbnail */}
        {bagColor ? (
          <LabelCard coffee={coffee} size="medium" />
        ) : labelImage ? (
          <LabelThumbnail src={labelImage} size={90} />
        ) : (
          <div style={{
            width: 90, height: 110,
            background: "linear-gradient(145deg, #F5EDE5, #E8DFD5)",
            borderRadius: 8, border: "1px solid var(--border)",
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
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 17,
            fontWeight: 700,
            marginBottom: 4,
            lineHeight: 1.2,
          }}>
            {name || "Unnamed Coffee"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>
            {dosesLeft} dose{dosesLeft !== 1 ? "s" : ""} left · ~{gramsLeft}g
          </div>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            background: isStale ? "rgba(220,80,40,0.1)" : "rgba(58,124,165,0.1)",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            color: isStale ? "var(--error)" : "var(--ice)",
          }}>
            Day {daysSincePulled} of thaw
            {isStale && <span style={{ fontSize: 10, fontWeight: 700 }}>!</span>}
          </div>
          {remainingPortions > 0 && (
            <div style={{ fontSize: 11, color: "var(--ice)", marginTop: 4 }}>
              +{remainingPortions} portion{remainingPortions !== 1 ? "s" : ""} in freezer
            </div>
          )}
        </div>
      </div>

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

function FreezerStats({ grams, portions, doses, daysLeft }) {
  return (
    <div>
      <SectionHeader icon="❄" title="Freezer Stats" color="var(--ice)" />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <StatCard value={`${grams}g`} label="total" color="var(--ice)" />
        <StatCard value={portions} label={portions === 1 ? "portion" : "portions"} color="var(--ice)" />
        <StatCard value={doses} label="doses" color="var(--ice)" />
      </div>
      {daysLeft !== null && (
        <div style={{
          textAlign: "center",
          fontSize: 12,
          color: "var(--muted)",
          padding: "8px 0",
          background: "var(--card)",
          borderRadius: 6,
          border: "1px solid var(--border)",
        }}>
          ~{daysLeft} days of coffee remaining
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

// ─── Main Overview Component ───

export default function Overview({ stats, onUseDose, onPullFromFreezer, onViewResting }) {
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
        <div style={{ fontSize: 15, marginBottom: 8 }}>Welcome to Channeling</div>
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
        />
      </div>

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
          daysLeft={estimatedDaysLeft}
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

      {/* Recent Activity */}
      <RecentActivity
        recentlyAdded={recentlyAdded}
        lastFinished={lastFinished}
      />
    </div>
  );
}

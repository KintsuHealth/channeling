import { getRoastQuarter, isSameBatch } from '../lib/roastBatch';
import { getRecipes, primaryRecipe } from '../lib/recipes';

function MiniLabelCard({ coffee }) {
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

  return (
    <div
      style={{
        width: 80,
        height: 90,
        background: `linear-gradient(145deg, ${bgColor} 0%, ${bgColor}ee 100%)`,
        borderRadius: 10,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
        flexShrink: 0,
      }}
    >
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: primary,
        lineHeight: 1.2,
        fontFamily: "'Playfair Display', Georgia, serif",
        textAlign: "center",
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
      }}>
        {coffee.name || "Unnamed"}
      </div>
    </div>
  );
}

function QuarterBadge({ quarter, size = "normal" }) {
  if (!quarter) return null;
  const isSmall = size === "small";
  return (
    <span style={{
      padding: isSmall ? "2px 6px" : "3px 8px",
      background: "var(--ice-bg)",
      border: "1px solid var(--ice)",
      borderRadius: 4,
      fontSize: isSmall ? 10 : 11,
      fontWeight: 600,
      color: "var(--ice)",
      fontFamily: "'DM Mono', monospace",
    }}>
      {quarter}
    </span>
  );
}

function RecipePreview({ coffee }) {
  const recipe = primaryRecipe(coffee);
  const count = getRecipes(coffee).length;
  if (!recipe || (!recipe.dose && !recipe.yield && !recipe.grind)) {
    return null;
  }

  return (
    <div style={{
      padding: "8px 12px",
      background: "linear-gradient(135deg, #FDF8F4 0%, #FAF0E6 100%)",
      border: "1px solid var(--accent-light)",
      borderRadius: 6,
      fontSize: 12,
      fontFamily: "'DM Mono', monospace",
    }}>
      <span style={{ fontWeight: 600 }}>{count > 1 ? (recipe.name || "Recipe") : "Recipe"}:</span>{" "}
      {recipe.dose && <span>{recipe.dose}g</span>}
      {recipe.yield && <span> → {recipe.yield}g</span>}
      {recipe.grind && <span> @ {recipe.grind}</span>}
      {count > 1 && <span style={{ color: "var(--muted)" }}> · +{count - 1} more</span>}
    </div>
  );
}

const STATUS_LABELS = {
  resting: { label: "Resting", color: "var(--accent)", icon: "○" },
  frozen: { label: "In Freezer", color: "var(--ice)", icon: "❄" },
  active: { label: "Active", color: "var(--active)", icon: "●" },
  done: { label: "Archived", color: "var(--done)", icon: "✓" },
};

export function DuplicateDetectionModal({
  matchedCoffee,
  newCoffee,
  onAddPortions,
  onCopyRecipe,
  onStartFresh,
  onClose,
}) {
  if (!matchedCoffee) return null;

  const matchQuarter = getRoastQuarter(matchedCoffee.roastDate);
  const newQuarter = getRoastQuarter(newCoffee?.roastDate);
  const sameBatch = isSameBatch(matchedCoffee, newCoffee);
  const matchPrimaryRecipe = primaryRecipe(matchedCoffee);
  const hasRecipe = !!(matchPrimaryRecipe?.dose || matchPrimaryRecipe?.yield || matchPrimaryRecipe?.grind);
  const status = STATUS_LABELS[matchedCoffee.status] || STATUS_LABELS.frozen;

  // Calculate remaining portions
  const portionsRemaining = (matchedCoffee.portions?.length || 0) - (matchedCoffee.portionIndex || 0);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 1001,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg)",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 440,
          maxHeight: "85vh",
          overflow: "auto",
          padding: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text)",
          }}>
            Similar Coffee Found
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              color: "var(--muted)",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Matched Coffee Preview */}
        <div style={{
          padding: 16,
          background: "var(--card)",
          borderRadius: 12,
          border: "1px solid var(--border)",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <MiniLabelCard coffee={matchedCoffee} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "'Playfair Display', serif",
                color: "var(--text)",
                marginBottom: 4,
                lineHeight: 1.2,
              }}>
                {matchedCoffee.name}
              </div>
              {matchedCoffee.roaster && (
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>
                  by {matchedCoffee.roaster}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  color: status.color,
                }}>
                  <span>{status.icon}</span>
                  {status.label}
                </span>
                <QuarterBadge quarter={matchQuarter} size="small" />
                {portionsRemaining > 0 && (
                  <span style={{
                    fontSize: 11,
                    color: "var(--muted)",
                  }}>
                    {portionsRemaining} portion{portionsRemaining !== 1 ? 's' : ''} left
                  </span>
                )}
              </div>
              {hasRecipe && <RecipePreview coffee={matchedCoffee} />}
            </div>
          </div>
        </div>

        {/* New Coffee Badge Info */}
        <div style={{
          padding: "12px 16px",
          background: newQuarter && !sameBatch ? "var(--active-bg)" : "var(--ice-bg)",
          border: `1px solid ${newQuarter && !sameBatch ? "var(--active)" : "var(--ice)"}`,
          borderRadius: 8,
          marginBottom: 20,
          fontSize: 13,
        }}>
          <span style={{ fontWeight: 600 }}>Your new bag:</span>{" "}
          {newQuarter ? (
            <>
              <QuarterBadge quarter={newQuarter} size="small" />
              {sameBatch ? (
                <span style={{ color: "var(--success)", marginLeft: 8 }}>(same batch)</span>
              ) : (
                <span style={{ color: "var(--active)", marginLeft: 8 }}>(different batch)</span>
              )}
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}>No roast date</span>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Add Portions */}
          <button
            onClick={onAddPortions}
            style={{
              width: "100%",
              padding: "14px 16px",
              background: sameBatch ? "var(--ice)" : "var(--card)",
              border: sameBatch ? "none" : "1.5px solid var(--border)",
              borderRadius: 10,
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{
              fontSize: 20,
              width: 28,
              textAlign: "center",
              color: sameBatch ? "#fff" : "var(--ice)",
            }}>
              +
            </span>
            <div>
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                color: sameBatch ? "#fff" : "var(--text)",
              }}>
                Add to {matchQuarter || 'existing'} batch
              </div>
              <div style={{
                fontSize: 11,
                color: sameBatch ? "rgba(255,255,255,0.8)" : "var(--muted)",
                marginTop: 2,
              }}>
                Merge portions into existing coffee
              </div>
            </div>
            {sameBatch && (
              <span style={{
                marginLeft: "auto",
                fontSize: 10,
                fontWeight: 600,
                background: "rgba(255,255,255,0.2)",
                padding: "3px 8px",
                borderRadius: 4,
                color: "#fff",
              }}>
                SAME BATCH
              </span>
            )}
          </button>

          {/* Copy Recipe */}
          <button
            onClick={onCopyRecipe}
            style={{
              width: "100%",
              padding: "14px 16px",
              background: !sameBatch && hasRecipe ? "var(--accent)" : "var(--card)",
              border: !sameBatch && hasRecipe ? "none" : "1.5px solid var(--border)",
              borderRadius: 10,
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{
              fontSize: 18,
              width: 28,
              textAlign: "center",
              color: !sameBatch && hasRecipe ? "#fff" : "var(--accent)",
            }}>
              ◐
            </span>
            <div>
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                color: !sameBatch && hasRecipe ? "#fff" : "var(--text)",
              }}>
                New batch, copy recipe
              </div>
              <div style={{
                fontSize: 11,
                color: !sameBatch && hasRecipe ? "rgba(255,255,255,0.8)" : "var(--muted)",
                marginTop: 2,
              }}>
                {hasRecipe
                  ? "Start fresh but inherit saved recipes"
                  : "No recipe to copy — will start blank"
                }
              </div>
            </div>
            {!sameBatch && hasRecipe && (
              <span style={{
                marginLeft: "auto",
                fontSize: 10,
                fontWeight: 600,
                background: "rgba(255,255,255,0.2)",
                padding: "3px 8px",
                borderRadius: 4,
                color: "#fff",
              }}>
                RECOMMENDED
              </span>
            )}
          </button>

          {/* Start Fresh */}
          <button
            onClick={onStartFresh}
            style={{
              width: "100%",
              padding: "14px 16px",
              background: "var(--card)",
              border: "1.5px solid var(--border)",
              borderRadius: 10,
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{
              fontSize: 18,
              width: 28,
              textAlign: "center",
              color: "var(--muted)",
            }}>
              ○
            </span>
            <div>
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text)",
              }}>
                Start completely fresh
              </div>
              <div style={{
                fontSize: 11,
                color: "var(--muted)",
                marginTop: 2,
              }}>
                Independent coffee, no recipe copied
              </div>
            </div>
          </button>
        </div>

        {/* Cancel */}
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px",
            marginTop: 16,
            background: "none",
            border: "none",
            fontSize: 14,
            fontWeight: 500,
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

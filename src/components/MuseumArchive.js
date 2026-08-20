import { useMemo, useState } from "react";
import { getRecipes, primaryEspressoRecipe, recipeMethod } from "../lib/recipes";
import { translateGrind, basketById, machineById, recipeEquipment } from "../lib/equipment";
import CoverFlow from "./CoverFlow";
import CardMenu from "./CardMenu";

// The archive as a museum: finished bags hang as works in dated exhibitions,
// each with a placard — origin, tenure (acquired → consumed), and how it was
// dialed. Tap a piece for the full detail modal.

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
const fmtShort = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

// Exhibition = quarter of the consumption date.
function exhibitionKey(c) {
  const d = new Date(c.finishedAt || c.addedAt);
  if (isNaN(d.getTime())) return "Undated";
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}·Q${q}`;
}

function exhibitionTitle(key) {
  if (key === "Undated") return "Undated";
  const [year, q] = key.split("·");
  const seasons = { Q1: "Winter", Q2: "Spring", Q3: "Summer", Q4: "Autumn" };
  return `${seasons[q] || q} ${year}`;
}

// The "work" — label photo when we have one, otherwise the digital bag card.
function BagArt({ coffee }) {
  const bgColor = coffee.bagColor || "#6B4423";
  const isDark = (hex) => {
    if (!hex || !hex.startsWith("#")) return true;
    const c = hex.replace("#", "");
    return (parseInt(c.substr(0, 2), 16) * 0.299 + parseInt(c.substr(2, 2), 16) * 0.587 + parseInt(c.substr(4, 2), 16) * 0.114) < 140;
  };
  const dark = isDark(bgColor);
  const primary = coffee.textColor || (dark ? "#FFFFFF" : "#1A1A1A");

  if (coffee.labelImage) {
    return (
      <img
        src={coffee.labelImage}
        alt={coffee.name || "Coffee label"}
        loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }
  return (
    <div style={{
      width: "100%", height: "100%",
      background: `linear-gradient(150deg, ${bgColor} 0%, ${bgColor}dd 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 14, textAlign: "center",
    }}>
      {coffee.roaster && (
        <div style={{ fontSize: 8, fontWeight: 600, color: primary, opacity: 0.7, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>
          {coffee.roaster}
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: primary, lineHeight: 1.3 }}>
        {coffee.name || "Unnamed"}
      </div>
      {coffee.country && (
        <div style={{ fontSize: 9, fontWeight: 500, color: primary, opacity: 0.75, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {coffee.country}
        </div>
      )}
    </div>
  );
}

function Piece({ coffee, currentSetup, allCoffees, onView, onUnarchive, onEdit, onDelete, onCutout, onUncutout, cuttingId }) {
  const rec = primaryEspressoRecipe(coffee) || getRecipes(coffee)[0] || null;
  const grindNum = rec ? parseFloat(rec.grind) : NaN;
  const translated = rec ? translateGrind(rec, currentSetup, allCoffees) : null;
  const recEquip = rec ? recipeEquipment(rec) : null;
  const pours = getRecipes(coffee).filter((r) => recipeMethod(r) === "pourover").length;
  const shotCount = getRecipes(coffee).reduce((s, r) => s + (r.shots?.length || 0), 0);

  const acquired = fmtShort(coffee.addedAt);
  const consumed = fmtShort(coffee.finishedAt);
  const tenureDays = coffee.addedAt && coffee.finishedAt
    ? Math.max(1, Math.round((new Date(coffee.finishedAt) - new Date(coffee.addedAt)) / 86400000))
    : null;

  return (
    <div style={{ animation: "fadeUp 0.3s ease both" }}>
      {/* The work — a floating cutout when we have one, otherwise framed */}
      {coffee.labelCutout ? (
        <div
          onClick={() => onView(coffee)}
          style={{ cursor: "pointer", aspectRatio: "4 / 5", display: "flex", alignItems: "center", justifyContent: "center", padding: 6 }}
        >
          <img
            src={coffee.labelCutout}
            alt={coffee.name || "Coffee bag"}
            loading="lazy"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", filter: "drop-shadow(0 14px 22px rgba(32,27,22,0.28))" }}
          />
        </div>
      ) : (
        <div
          onClick={() => onView(coffee)}
          style={{
            cursor: "pointer",
            background: "var(--card)",
            padding: 10,
            borderRadius: 4,
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ aspectRatio: "4 / 5", overflow: "hidden", background: "#F2EEE8" }}>
            <BagArt coffee={coffee} />
          </div>
        </div>
      )}

      {/* The placard */}
      <div
        onClick={() => onView(coffee)}
        style={{
          margin: "10px 6px 0",
          padding: "10px 12px",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          cursor: "pointer",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
            {coffee.name || "Unnamed"}
            {coffee.favorite && <span style={{ color: "var(--star)", fontSize: 11, marginLeft: 4 }}>★</span>}
          </div>
          {coffee.rating > 0 && (
            <span style={{ fontSize: 9, letterSpacing: 1, color: "var(--star)", whiteSpace: "nowrap" }}>
              {"●".repeat(coffee.rating)}<span style={{ color: "var(--star-off)" }}>{"●".repeat(5 - coffee.rating)}</span>
            </span>
          )}
        </div>

        <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.5 }}>
          {[coffee.roaster, coffee.country, coffee.variety, coffee.process].filter(Boolean).join(" · ")}
        </div>

        {(acquired || consumed) && (
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
            {acquired || "?"} — {consumed || "?"}
            {tenureDays && <span style={{ opacity: 0.7 }}> · {tenureDays}d</span>}
            {coffee.gramsTotal ? <span style={{ opacity: 0.7 }}> · {coffee.gramsTotal}g</span> : null}
          </div>
        )}

        {/* Dial-in story */}
        {rec && (rec.grind || rec.dose) && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", marginBottom: 3 }}>
              Dialed in
            </div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text)", lineHeight: 1.6 }}>
              {!isNaN(grindNum) && <span style={{ fontWeight: 700 }}>@{rec.grind}</span>}
              {rec.dose && <span> · {rec.dose}g→{rec.yield || "—"}g</span>}
              {(rec.totalTime || rec.time) && <span> · {rec.totalTime || rec.time}s</span>}
              {rec.temp && <span> · {rec.temp}°{rec.tempUnit || "C"}</span>}
            </div>
            {recEquip && (
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>
                on {machineById(recEquip.machineId).short} · {basketById(recEquip.basketId).short}
              </div>
            )}
            {translated && (
              <div style={{ fontSize: 10, color: "var(--success)", fontWeight: 600, marginTop: 3 }}>
                ≈ @{translated.grind} on your {basketById(currentSetup.basketId).short}
                {translated.learned ? "" : " (est.)"}
              </div>
            )}
            {shotCount > 0 && (
              <div style={{ fontSize: 9.5, color: "var(--muted)", marginTop: 2 }}>dialed in over {shotCount} logged shot{shotCount !== 1 ? "s" : ""}</div>
            )}
            {pours > 0 && (
              <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2 }}>+{pours} pour-over recipe{pours !== 1 ? "s" : ""}</div>
            )}
          </div>
        )}

        {coffee.tastingNotes && (
          <div style={{ fontSize: 10.5, color: "var(--muted)", fontStyle: "italic", marginTop: 7, lineHeight: 1.5 }}>
            “{coffee.tastingNotes}”
          </div>
        )}
      </div>

      {/* Curator actions */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
        {cuttingId === coffee.id ? (
          <span style={{ fontSize: 11, color: "var(--muted)", padding: "6px 0" }}>✂ Cutting…</span>
        ) : (
          <CardMenu size={28} items={[
            coffee.labelImage && !coffee.labelCutout && onCutout && { label: "Cut out bag", icon: "✂", onClick: () => onCutout(coffee) },
            coffee.labelCutout && onUncutout && { label: "Undo cutout", icon: "↩", onClick: () => onUncutout(coffee.id) },
            { label: "Return to freezer", icon: "❄", onClick: () => onUnarchive(coffee.id) },
            { label: "Edit", icon: "✎", onClick: () => onEdit(coffee) },
            { label: "Delete", icon: "✕", danger: true, onClick: () => onDelete(coffee.id) },
          ]} />
        )}
      </div>
    </div>
  );
}

export default function MuseumArchive({ archive, currentSetup, allCoffees, onView, onUnarchive, onEdit, onDelete, onCutout, onUncutout, cuttingId }) {
  const [listMode, setListMode] = useState(false);

  const exhibitions = useMemo(() => {
    const groups = new Map();
    for (const c of archive) {
      const key = exhibitionKey(c);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    return [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [archive]);

  if (archive.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
        <div style={{ fontSize: 30, marginBottom: 10, opacity: 0.4 }}>◻</div>
        <div style={{ fontSize: 13 }}>The collection is empty.<br />Finished bags are hung here.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>The Collection</div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
            {archive.length} work{archive.length !== 1 ? "s" : ""} · {exhibitions.length} exhibition{exhibitions.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button
          onClick={() => setListMode(!listMode)}
          style={{ padding: "6px 12px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}
        >
          {listMode ? "◫ Gallery" : "≡ List"}
        </button>
      </div>

      {!listMode && archive.length >= 3 && (
        <CoverFlow
          coffees={archive}
          onSelect={onView}
          caption={(c) => [c.roaster, fmtDate(c.finishedAt || c.addedAt)].filter(Boolean).join(" · ")}
        />
      )}

      {listMode ? (
        archive.map((c) => (
          <div key={c.id} onClick={() => onView(c)} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 14px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {c.name || "Unnamed"} {c.favorite && <span style={{ color: "var(--star)", fontSize: 11 }}>★</span>}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                {[c.roaster, c.country].filter(Boolean).join(" · ")} · {fmtDate(c.finishedAt || c.addedAt)}
              </div>
            </div>
            <CardMenu size={28} items={[
              { label: "Return to freezer", icon: "❄", onClick: () => onUnarchive(c.id) },
              { label: "Edit", icon: "✎", onClick: () => onEdit(c) },
              { label: "Delete", icon: "✕", danger: true, onClick: () => onDelete(c.id) },
            ]} />
          </div>
        ))
      ) : (
        exhibitions.map(([key, works]) => (
          <div key={key} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>{exhibitionTitle(key)}</div>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <div style={{ fontSize: 10, color: "var(--muted)" }}>{works.length}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px 14px" }}>
              {works.map((c) => (
                <Piece
                  key={c.id}
                  coffee={c}
                  currentSetup={currentSetup}
                  allCoffees={allCoffees}
                  onView={onView}
                  onUnarchive={onUnarchive}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onCutout={onCutout}
                  onUncutout={onUncutout}
                  cuttingId={cuttingId}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

import { useState } from "react";
import { compressImage, fileToDataUrl } from "../lib/image";

// ─── Stars (display + interactive input) ───
function Stars({ value, size = 12 }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= value ? "var(--star)" : "var(--star-off)" }}>●</span>
      ))}
    </span>
  );
}

function StarInput({ value, onChange, size = 22 }) {
  return (
    <span style={{ fontSize: size, letterSpacing: 3, cursor: "pointer" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} onClick={() => onChange(s === value ? 0 : s)} style={{ color: s <= value ? "var(--star)" : "var(--star-off)" }}>★</span>
      ))}
    </span>
  );
}

function sinceLabel(iso) {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

// ─── Add sheet ───
function AddPourSheet({ onSave, onClose }) {
  const [preview, setPreview] = useState(null);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [beanName, setBeanName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const onFile = async (file) => {
    if (!file) return;
    setError(null);
    const name = file.name?.toLowerCase() || "";
    const isHeic = file.type === "image/heic" || file.type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif");
    if (isHeic) { setError("HEIC isn't supported — take a screenshot, or set Camera → Formats → Most Compatible."); return; }
    if (file.type && !file.type.startsWith("image/")) { setError("Select an image."); return; }
    try {
      const compressed = await compressImage(file);
      setPreview(await fileToDataUrl(compressed));
    } catch {
      setError("Couldn't read that image.");
    }
  };

  const save = async () => {
    if (!preview || saving) return;
    setSaving(true);
    try {
      const ok = await onSave({ preview, rating, note: note.trim(), beanName: beanName.trim() });
      if (ok) { onClose(); return; }
      setError("Couldn't save the pour. Try again.");
    } catch {
      setError("Couldn't save the pour. Try again.");
    }
    setSaving(false);
  };

  const inputStyle = { width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, background: "#fff", color: "var(--text)" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 1100 }} onClick={() => { if (!saving) onClose(); }}>
      <div style={{ width: "100%", maxWidth: 480, background: "var(--bg, #fff)", borderRadius: "16px 16px 0 0", padding: "18px 18px 24px", maxHeight: "92vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-dark)" }}>📷 New pour</div>
          <button onClick={onClose} disabled={saving} style={{ background: "none", border: "none", fontSize: 20, color: "var(--muted)", cursor: "pointer", opacity: saving ? 0.4 : 1 }}>×</button>
        </div>

        {preview ? (
          <div style={{ position: "relative", marginBottom: 14 }}>
            <img src={preview} alt="pour" style={{ width: "100%", borderRadius: 10, display: "block" }} />
            <button onClick={() => setPreview(null)} style={{ position: "absolute", top: 8, right: 8, padding: "4px 10px", background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", borderRadius: 6, fontSize: 11 }}>Retake</button>
          </div>
        ) : (
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "36px 18px", marginBottom: 14, border: "1.5px dashed var(--border)", borderRadius: 10, cursor: "pointer", color: "var(--muted)" }}>
            <span style={{ fontSize: 30 }}>＋</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Take / choose a photo</span>
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Rating</span>
          <StarInput value={rating} onChange={setRating} />
        </div>

        <input value={beanName} onChange={(e) => setBeanName(e.target.value)} placeholder="Bean (optional) — e.g. Belén Geisha" style={{ ...inputStyle, marginBottom: 10 }} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional) — e.g. clean rosetta, milk a touch hot" style={{ ...inputStyle, marginBottom: 14 }} />

        {error && <div style={{ fontSize: 12, color: "var(--error)", marginBottom: 10 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={saving} style={{ flex: 1, padding: "11px 0", background: "none", border: "1px solid var(--border)", borderRadius: 8, fontSize: 13, color: "var(--muted)", opacity: saving ? 0.5 : 1 }}>Cancel</button>
          <button onClick={save} disabled={!preview || saving} style={{ flex: 2, padding: "11px 0", background: "var(--accent-dark)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, opacity: (!preview || saving) ? 0.5 : 1 }}>
            {saving ? "Saving…" : "Save pour"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lightbox ───
function Lightbox({ pour, onDelete, onClose }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 20 }} onClick={onClose}>
      <img src={pour.photoUrl} alt="pour" style={{ maxWidth: "100%", maxHeight: "70vh", borderRadius: 10, objectFit: "contain" }} onClick={(e) => e.stopPropagation()} />
      <div style={{ marginTop: 14, textAlign: "center", color: "#fff" }} onClick={(e) => e.stopPropagation()}>
        {pour.rating > 0 && <div style={{ marginBottom: 6 }}><Stars value={pour.rating} size={16} /></div>}
        {pour.beanName && <div style={{ fontSize: 13, fontWeight: 600 }}>{pour.beanName}</div>}
        {pour.note && <div style={{ fontSize: 12, fontStyle: "italic", color: "rgba(255,255,255,0.85)", marginTop: 2 }}>"{pour.note}"</div>}
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>{sinceLabel(pour.createdAt)}</div>
        <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center" }}>
          {confirming ? (
            <>
              <button onClick={async () => { const ok = await onDelete(pour); if (ok) onClose(); else setConfirming(false); }} style={{ padding: "8px 16px", background: "var(--error)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Delete pour</button>
              <button onClick={() => setConfirming(false)} style={{ padding: "8px 16px", background: "none", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 8, fontSize: 12 }}>Keep</button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirming(true)} style={{ padding: "8px 16px", background: "none", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 8, fontSize: 12 }}>Delete</button>
              <button onClick={onClose} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12 }}>Close</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Strip ───
export default function LatteArtStrip({ pours = [], createPour, deletePour }) {
  const [showAdd, setShowAdd] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const rated = pours.filter((p) => p.rating > 0);
  const avg = rated.length ? (rated.reduce((s, p) => s + p.rating, 0) / rated.length) : 0;
  const caption = pours.length === 0
    ? "No pours yet — log your first"
    : `${pours.length} pour${pours.length !== 1 ? "s" : ""} · last ${sinceLabel(pours[0].createdAt)}${avg ? ` · ★ ${avg.toFixed(1)}` : ""}`;

  const handleSave = async ({ preview, rating, note, beanName }) => {
    const pour = await createPour({ base64: preview, rating, note, beanName });
    return !!pour;
  };

  const tile = { width: 76, height: 76, borderRadius: 8, flexShrink: 0, border: "1px solid var(--border)", overflow: "hidden", position: "relative", cursor: "pointer" };

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--accent)", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <span>📷</span> Latte Art
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>{caption}</div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
        <button onClick={() => setShowAdd(true)} style={{ ...tile, background: "var(--card)", border: "1.5px dashed var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>＋</span>
          <span style={{ fontSize: 9, marginTop: 2 }}>Add</span>
        </button>
        {pours.map((p) => (
          <div key={p.id} style={tile} onClick={() => setLightbox(p)}>
            <img src={p.photoUrl} alt="pour" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {p.rating > 0 && (
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "2px 4px", background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)", textAlign: "center" }}>
                <Stars value={p.rating} size={8} />
              </div>
            )}
          </div>
        ))}
      </div>

      {showAdd && <AddPourSheet onSave={handleSave} onClose={() => setShowAdd(false)} />}
      {lightbox && <Lightbox pour={lightbox} onDelete={deletePour} onClose={() => setLightbox(null)} />}
    </div>
  );
}

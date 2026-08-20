import { useState } from "react";

// One "···" per card instead of a row of tiny bordered buttons. Items:
// { label, icon, onClick, danger }. Renders its own backdrop so a tap
// anywhere else closes it.
export default function CardMenu({ items, size = 30 }) {
  const [open, setOpen] = useState(false);
  const visible = (items || []).filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(!open)}
        aria-label="More actions"
        style={{
          width: size, height: size, borderRadius: size / 2,
          background: open ? "var(--tag)" : "transparent",
          border: "1px solid var(--border)",
          color: "var(--muted)", fontSize: 15, fontWeight: 700, lineHeight: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >···</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 400 }} />
          <div style={{
            position: "absolute", right: 0, top: size + 6, zIndex: 401,
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
            boxShadow: "var(--shadow-lg)", padding: 4, minWidth: 168,
            animation: "fadeUp 0.12s ease both",
          }}>
            {visible.map((item, i) => (
              <button
                key={i}
                onClick={() => { setOpen(false); item.onClick(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                  padding: "9px 12px", background: "none", border: "none", borderRadius: 8,
                  fontSize: 12.5, fontWeight: 500, textAlign: "left",
                  color: item.danger ? "var(--error)" : "var(--text)",
                }}
              >
                <span style={{ width: 16, textAlign: "center", opacity: 0.8 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

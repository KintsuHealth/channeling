import { useRef, useState } from "react";
import { createPortal } from "react-dom";

// One "···" per card instead of a row of tiny bordered buttons. Items:
// { label, icon, onClick, danger }. The dropdown is portaled to <body> with
// fixed positioning so it can never be painted over by sibling cards
// (transforms/animations on cards create stacking contexts that would
// otherwise clip or cover an absolutely-positioned menu).
export default function CardMenu({ items, size = 30 }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const visible = (items || []).filter(Boolean);
  if (visible.length === 0) return null;

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuH = visible.length * 38 + 8;
      const openUp = r.bottom + menuH > window.innerHeight - 80;
      setPos({
        top: openUp ? Math.max(8, r.top - menuH - 6) : r.bottom + 6,
        right: Math.max(8, window.innerWidth - r.right),
      });
    }
    setOpen(!open);
  };

  return (
    <div style={{ position: "relative", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="More actions"
        style={{
          width: size, height: size, borderRadius: size / 2,
          background: open ? "var(--tag)" : "transparent",
          border: "1px solid var(--border)",
          color: "var(--muted)", fontSize: 15, fontWeight: 700, lineHeight: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >···</button>
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 900 }} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed", top: pos.top, right: pos.right, zIndex: 901,
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
              boxShadow: "var(--shadow-lg)", padding: 4, minWidth: 168,
              animation: "fadeUp 0.12s ease both",
            }}
          >
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
        </>,
        document.body
      )}
    </div>
  );
}

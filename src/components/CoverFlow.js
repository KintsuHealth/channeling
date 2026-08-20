import { useEffect, useRef, useState } from "react";

// Cover Flow — the classic iTunes/iPod treatment: a draggable strip of covers
// with 3D perspective, the centered cover flat and forward, neighbours angled
// away. Pure scroll-driven (native momentum + scroll-snap), transforms derived
// from scroll position, so it feels right on touch.

const COVER_W = 118;
const COVER_H = 148;
const GAP = 18;

function CoverArt({ coffee }) {
  if (coffee.labelCutout) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 4 }}>
        <img src={coffee.labelCutout} alt={coffee.name || "Coffee"} loading="lazy" draggable={false}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", filter: "drop-shadow(0 8px 12px rgba(32,27,22,0.3))" }} />
      </div>
    );
  }
  if (coffee.labelImage) {
    return <img src={coffee.labelImage} alt={coffee.name || "Coffee"} loading="lazy" draggable={false}
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", borderRadius: 8 }} />;
  }
  const bgColor = coffee.bagColor || "#6B4423";
  const isDark = (hex) => {
    if (!hex || !hex.startsWith("#")) return true;
    const c = hex.replace("#", "");
    return (parseInt(c.substr(0, 2), 16) * 0.299 + parseInt(c.substr(2, 2), 16) * 0.587 + parseInt(c.substr(4, 2), 16) * 0.114) < 140;
  };
  const primary = coffee.textColor || (isDark(bgColor) ? "#FFFFFF" : "#1A1A1A");
  return (
    <div style={{
      width: "100%", height: "100%", borderRadius: 8,
      background: `linear-gradient(150deg, ${bgColor} 0%, ${bgColor}dd 100%)`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 10, textAlign: "center",
    }}>
      {coffee.roaster && <div style={{ fontSize: 7, fontWeight: 600, color: primary, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{coffee.roaster}</div>}
      <div style={{ fontSize: 12, fontWeight: 700, color: primary, lineHeight: 1.25 }}>{coffee.name || "Unnamed"}</div>
    </div>
  );
}

export default function CoverFlow({ coffees, onSelect, caption }) {
  const trackRef = useRef(null);
  const rafRef = useRef(null);
  const [scroll, setScroll] = useState(0);
  const [width, setWidth] = useState(540);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const onScroll = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (trackRef.current) setScroll(trackRef.current.scrollLeft);
    });
  };

  if (!coffees || coffees.length === 0) return null;

  const pad = Math.max(0, (width - COVER_W) / 2);
  const viewCenter = scroll + width / 2;
  const step = COVER_W + GAP;
  const centeredIdx = Math.round((viewCenter - pad - COVER_W / 2) / step);
  const centered = coffees[Math.max(0, Math.min(coffees.length - 1, centeredIdx))];

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        ref={trackRef}
        onScroll={onScroll}
        style={{
          display: "flex", gap: GAP, overflowX: "auto",
          padding: `14px ${pad}px 8px`,
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          perspective: 700,
          perspectiveOrigin: "50% 50%",
        }}
      >
        {coffees.map((c, i) => {
          const itemCenter = pad + i * step + COVER_W / 2;
          const offset = (itemCenter - viewCenter) / step; // 0 = centered
          const clamped = Math.max(-3, Math.min(3, offset));
          const abs = Math.abs(clamped);
          const rotate = Math.max(-50, Math.min(50, clamped * -38));
          const scale = 1 - Math.min(abs, 2) * 0.09;
          const z = abs < 0.5 ? 60 : -abs * 34;
          return (
            <div
              key={c.id}
              onClick={() => {
                const el = trackRef.current;
                if (abs > 0.5 && el) {
                  el.scrollTo({ left: itemCenter - width / 2, behavior: "smooth" });
                } else {
                  onSelect?.(c);
                }
              }}
              style={{
                width: COVER_W, height: COVER_H, flexShrink: 0,
                scrollSnapAlign: "center",
                transform: `translateZ(${z}px) rotateY(${rotate}deg) scale(${scale})`,
                transformStyle: "preserve-3d",
                transition: "transform 0.08s linear",
                zIndex: Math.round(100 - abs * 10),
                cursor: "pointer",
                borderRadius: 8,
                overflow: c.labelCutout ? "visible" : "hidden",
                background: c.labelCutout ? "transparent" : "var(--card)",
                boxShadow: c.labelCutout ? "none" : "0 10px 24px rgba(32,27,22,0.22)",
              }}
            >
              <CoverArt coffee={c} />
            </div>
          );
        })}
      </div>
      {/* Reflection line + centered title, like the old iTunes shelf */}
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, var(--border), transparent)", margin: "2px 24px 8px" }} />
      {centered && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{centered.name || "Unnamed"}</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 1 }}>
            {caption ? caption(centered) : [centered.roaster, centered.country].filter(Boolean).join(" · ")}
          </div>
        </div>
      )}
    </div>
  );
}

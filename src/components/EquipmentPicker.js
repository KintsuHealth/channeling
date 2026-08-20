import { useMemo } from "react";
import { MACHINES, BASKETS, learnEquipmentDelta, formatDelta, DEFAULT_MACHINE_ID, DEFAULT_BASKET_ID } from "../lib/equipment";

// Visual machine + basket selection. Machine cards use the studio renders in
// /public/machines; a missing image degrades to a monogram tile.

function MachineCard({ machine, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: "flex", flexDirection: "column", alignItems: "stretch",
        width: 128, flexShrink: 0, padding: 0, overflow: "hidden",
        background: "var(--card)",
        border: selected ? "2px solid var(--accent-dark)" : "1.5px solid var(--border)",
        borderRadius: 14, textAlign: "left",
        boxShadow: selected ? "var(--shadow-md)" : "var(--shadow-sm)",
        opacity: selected ? 1 : 0.82,
      }}
    >
      <div style={{ position: "relative", width: "100%", aspectRatio: "1", background: "linear-gradient(160deg, #F5F1EB 0%, #EDE7DE 100%)", padding: 8 }}>
        <img
          src={machine.image}
          alt={machine.name}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", filter: "drop-shadow(0 6px 10px rgba(32,27,22,0.22))" }}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        {selected && (
          <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: "50%", background: "var(--accent-dark)", color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✓</div>
        )}
      </div>
      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)", lineHeight: 1.25 }}>{machine.short}</div>
        <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 2, lineHeight: 1.35 }}>
          {machine.name === machine.short ? machine.profile.split(":")[0] : machine.name.replace(machine.short, "").trim() || machine.name}
        </div>
      </div>
    </button>
  );
}

export default function EquipmentPicker({ machineId, basketId, onMachineChange, onBasketChange, allCoffees }) {
  const currentMachine = machineId || DEFAULT_MACHINE_ID;
  const currentBasket = basketId || DEFAULT_BASKET_ID;

  // What switching baskets means for the dial, learned from paired shots.
  const basketDeltas = useMemo(() => {
    const map = {};
    for (const b of BASKETS) {
      if (b.id === DEFAULT_BASKET_ID) continue;
      map[b.id] = learnEquipmentDelta(
        allCoffees || [],
        { machineId: currentMachine, basketId: DEFAULT_BASKET_ID },
        { machineId: currentMachine, basketId: b.id }
      );
    }
    return map;
  }, [allCoffees, currentMachine]);

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", marginBottom: 8 }}>Machine</div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch" }}>
        {MACHINES.map((m) => (
          <MachineCard key={m.id} machine={m} selected={m.id === currentMachine} onSelect={() => onMachineChange(m.id)} />
        ))}
      </div>
      <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
        {MACHINES.find((m) => m.id === currentMachine)?.profile}
      </div>

      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent)", margin: "14px 0 8px" }}>Portafilter Basket</div>
      <div style={{ display: "flex", gap: 8 }}>
        {BASKETS.map((b) => {
          const selected = b.id === currentBasket;
          const d = basketDeltas[b.id];
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onBasketChange(b.id)}
              style={{
                flex: 1, padding: "10px 12px", textAlign: "left",
                background: selected ? "var(--accent-light)" : "var(--card)",
                border: selected ? "2px solid var(--accent-dark)" : "1.5px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: selected ? "var(--accent-dark)" : "var(--text)" }}>{b.short}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{b.doseG}g dose · {b.name.split(" ").slice(0, 2).join(" ")}</div>
              {d && (
                <div style={{ fontSize: 9.5, marginTop: 4, color: d.learned ? "var(--success)" : "var(--muted)", fontWeight: 600 }}>
                  {d.learned
                    ? `Learned: ${formatDelta(d.delta)} (${d.pairs} paired dial-in${d.pairs !== 1 ? "s" : ""})`
                    : `Starting estimate: ${formatDelta(d.delta)} vs stock`}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

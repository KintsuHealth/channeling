import { useState } from "react";

function AltitudeSelector({ value, onChange }) {
  const options = [
    { key: "high", label: "High", desc: "1800m+" },
    { key: "mid", label: "Mid", desc: "1400-1800m" },
    { key: "low", label: "Low", desc: "<1400m" },
    { key: null, label: "Unknown", desc: "" },
  ];
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map((o) => (
        <button
          key={o.key || "null"}
          type="button"
          onClick={() => onChange(o.key)}
          style={{
            flex: 1,
            padding: "6px 4px",
            border: `1.5px solid ${value === o.key ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 6,
            background: value === o.key ? "var(--accent-light)" : "#fff",
            color: value === o.key ? "var(--accent-dark)" : "var(--muted)",
            fontSize: 10,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s",
            textAlign: "center",
          }}
        >
          <div>{o.label}</div>
          {o.desc && <div style={{ fontSize: 8, opacity: 0.7, marginTop: 1 }}>{o.desc}</div>}
        </button>
      ))}
    </div>
  );
}

export function EditCoffeeModal({ coffee, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: coffee.name || "",
    roaster: coffee.roaster || "",
    country: coffee.country || "",
    region: coffee.region || "",
    variety: coffee.variety || "",
    producer: coffee.producer || "",
    roastLevel: coffee.roastLevel || "",
    process: coffee.process || "",
    altitude: coffee.altitude || "",
    altitudeCategory: coffee.altitudeCategory || null,
    price: coffee.price || "",
    roastDate: coffee.roastDate ? coffee.roastDate.split("T")[0] : "",
    tastingNotes: coffee.tastingNotes || "",
    bagColor: coffee.bagColor || "#6B4423",
    textColor: coffee.textColor || "#FFFFFF",
  });

  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [suggestError, setSuggestError] = useState(null);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const updates = { ...form };
    // Convert roastDate back to ISO if provided
    if (updates.roastDate) {
      updates.roastDate = new Date(updates.roastDate).toISOString();
    }
    onSave(updates);
  };

  const fetchSuggestions = async () => {
    setSuggesting(true);
    setSuggestError(null);
    setSuggestions(null);

    try {
      const res = await fetch("/api/suggest-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        throw new Error("Failed to get suggestions");
      }

      const data = await res.json();
      if (data.suggestions && Object.keys(data.suggestions).length > 0) {
        // Filter out null suggestions
        const validSuggestions = {};
        for (const [key, value] of Object.entries(data.suggestions)) {
          if (value !== null) {
            validSuggestions[key] = value;
          }
        }
        if (Object.keys(validSuggestions).length > 0) {
          setSuggestions({ ...data, suggestions: validSuggestions });
        } else {
          setSuggestError("Could not determine suggestions with available data");
        }
      } else {
        setSuggestError(data.notes || "No suggestions available");
      }
    } catch (err) {
      setSuggestError(err.message);
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestions = () => {
    if (!suggestions?.suggestions) return;
    setForm((prev) => ({
      ...prev,
      ...suggestions.suggestions,
    }));
    setSuggestions(null);
  };

  const needsSuggestions = !form.region || !form.altitude;

  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1.5px solid var(--border)",
    borderRadius: 8,
    fontSize: 14,
    background: "#fff",
  };

  const labelStyle = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--muted)",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--bg)",
          borderRadius: "16px 16px 0 0",
          width: "100%",
          maxWidth: 540,
          maxHeight: "85vh",
          overflow: "auto",
          padding: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontFamily: "'Playfair Display', serif" }}>Edit Coffee</h2>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              color: "var(--muted)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gap: 16 }}>
            {/* Name */}
            <div>
              <label style={labelStyle}>Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                style={inputStyle}
                placeholder="Coffee name"
              />
            </div>

            {/* Roaster & Producer row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Roaster</label>
                <input
                  type="text"
                  value={form.roaster}
                  onChange={(e) => handleChange("roaster", e.target.value)}
                  style={inputStyle}
                  placeholder="Roaster"
                />
              </div>
              <div>
                <label style={labelStyle}>Producer</label>
                <input
                  type="text"
                  value={form.producer}
                  onChange={(e) => handleChange("producer", e.target.value)}
                  style={inputStyle}
                  placeholder="Farm/Producer"
                />
              </div>
            </div>

            {/* Country & Region row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Country</label>
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => handleChange("country", e.target.value)}
                  style={inputStyle}
                  placeholder="Origin country"
                />
              </div>
              <div>
                <label style={labelStyle}>Region</label>
                <input
                  type="text"
                  value={form.region}
                  onChange={(e) => handleChange("region", e.target.value)}
                  style={{ ...inputStyle, borderColor: !form.region ? "var(--accent-light)" : "var(--border)" }}
                  placeholder="Region"
                />
              </div>
            </div>

            {/* Variety & Process row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Variety</label>
                <input
                  type="text"
                  value={form.variety}
                  onChange={(e) => handleChange("variety", e.target.value)}
                  style={inputStyle}
                  placeholder="Bourbon, Geisha, etc."
                />
              </div>
              <div>
                <label style={labelStyle}>Process</label>
                <input
                  type="text"
                  value={form.process}
                  onChange={(e) => handleChange("process", e.target.value)}
                  style={inputStyle}
                  placeholder="Washed, Natural, etc."
                />
              </div>
            </div>

            {/* Altitude row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Altitude</label>
                <input
                  type="text"
                  value={form.altitude}
                  onChange={(e) => handleChange("altitude", e.target.value)}
                  style={{ ...inputStyle, borderColor: !form.altitude ? "var(--accent-light)" : "var(--border)" }}
                  placeholder="e.g. 1800-2100m"
                />
              </div>
              <div>
                <label style={labelStyle}>Altitude Category</label>
                <AltitudeSelector
                  value={form.altitudeCategory}
                  onChange={(v) => handleChange("altitudeCategory", v)}
                />
              </div>
            </div>

            {/* AI Suggestions */}
            {needsSuggestions && (
              <div
                style={{
                  padding: "12px 14px",
                  background: "var(--accent-light)",
                  border: "1px solid var(--accent)",
                  borderRadius: 8,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-dark)", marginBottom: 8 }}>
                  Missing region or altitude?
                </div>
                <button
                  type="button"
                  onClick={fetchSuggestions}
                  disabled={suggesting}
                  style={{
                    padding: "8px 16px",
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: suggesting ? "wait" : "pointer",
                    opacity: suggesting ? 0.7 : 1,
                  }}
                >
                  {suggesting ? "Looking up..." : "Suggest missing details"}
                </button>

                {suggestError && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "var(--error)" }}>{suggestError}</div>
                )}

                {suggestions && (
                  <div style={{ marginTop: 12, padding: "10px 12px", background: "#fff", borderRadius: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--success)", marginBottom: 6 }}>
                      Suggestions ({suggestions.confidence} confidence)
                    </div>
                    {Object.entries(suggestions.suggestions).map(([key, value]) => (
                      <div key={key} style={{ fontSize: 13, marginBottom: 4 }}>
                        <strong style={{ textTransform: "capitalize" }}>{key}:</strong> {value}
                      </div>
                    ))}
                    {suggestions.notes && (
                      <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic", marginTop: 6 }}>
                        {suggestions.notes}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={applySuggestions}
                      style={{
                        marginTop: 8,
                        padding: "6px 14px",
                        background: "var(--success)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Apply suggestions
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Roast Level & Price row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Roast Level</label>
                <select
                  value={form.roastLevel}
                  onChange={(e) => handleChange("roastLevel", e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select...</option>
                  <option value="Light">Light</option>
                  <option value="Medium">Medium</option>
                  <option value="Medium-Dark">Medium-Dark</option>
                  <option value="Dark">Dark</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Price</label>
                <input
                  type="text"
                  value={form.price}
                  onChange={(e) => handleChange("price", e.target.value)}
                  style={inputStyle}
                  placeholder="$XX"
                />
              </div>
            </div>

            {/* Roast Date */}
            <div>
              <label style={labelStyle}>Roast Date</label>
              <input
                type="date"
                value={form.roastDate}
                onChange={(e) => handleChange("roastDate", e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Tasting Notes */}
            <div>
              <label style={labelStyle}>Tasting Notes</label>
              <textarea
                value={form.tastingNotes}
                onChange={(e) => handleChange("tastingNotes", e.target.value)}
                style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
                placeholder="Flavor notes..."
              />
            </div>

            {/* Colors row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>Bag Color</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="color"
                    value={form.bagColor}
                    onChange={(e) => handleChange("bagColor", e.target.value)}
                    style={{ width: 40, height: 40, border: "none", cursor: "pointer" }}
                  />
                  <input
                    type="text"
                    value={form.bagColor}
                    onChange={(e) => handleChange("bagColor", e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Text Color</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="color"
                    value={form.textColor}
                    onChange={(e) => handleChange("textColor", e.target.value)}
                    style={{ width: 40, height: 40, border: "none", cursor: "pointer" }}
                  />
                  <input
                    type="text"
                    value={form.textColor}
                    onChange={(e) => handleChange("textColor", e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="#RRGGBB"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1,
                padding: "12px",
                background: "none",
                border: "1.5px solid var(--border)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: "12px",
                background: "var(--accent)",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

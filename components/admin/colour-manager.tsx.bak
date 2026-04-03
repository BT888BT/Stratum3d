"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Colour = { id: string; name: string; hex: string; available: boolean; sort_order: number };

export default function ColourManager({ initialColours }: { initialColours: Colour[] }) {
  const [colours, setColours] = useState(initialColours);
  const [newName, setNewName] = useState("");
  const [newHex, setNewHex] = useState("#888888");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function toggle(id: string, available: boolean) {
    setLoading(id);
    setError("");
    const res = await fetch("/api/admin/colours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, available: !available }),
    });
    if (!res.ok) { setError("Failed to update."); }
    else { setColours(c => c.map(x => x.id === id ? { ...x, available: !available } : x)); }
    setLoading(null);
  }

  async function addColour() {
    if (!newName.trim()) { setError("Name is required."); return; }
    setLoading("add");
    setError("");
    const res = await fetch("/api/admin/colours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), hex: newHex }),
    });
    if (!res.ok) { setError("Failed to add colour."); }
    else {
      setNewName(""); setNewHex("#888888");
      router.refresh();
    }
    setLoading(null);
  }

  async function deleteColour(id: string) {
    if (!confirm("Remove this colour?")) return;
    setLoading(id + "-del");
    const res = await fetch("/api/admin/colours", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) { setError("Failed to delete."); }
    else { setColours(c => c.filter(x => x.id !== id)); }
    setLoading(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {error && <div className="error-box">{error}</div>}

      {/* Colour list */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "40px 1fr 100px 120px 80px",
          gap: 12, padding: "12px 20px",
          background: "var(--bg2)", borderBottom: "1px solid var(--border)"
        }}>
          {["", "Colour", "Hex", "Status", ""].map((h, i) => (
            <span key={i} className="font-mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</span>
          ))}
        </div>

        {colours.map(c => (
          <div key={c.id} style={{
            display: "grid", gridTemplateColumns: "40px 1fr 100px 120px 80px",
            gap: 12, padding: "14px 20px",
            borderBottom: "1px solid var(--border)",
            alignItems: "center",
            opacity: loading === c.id ? 0.5 : 1
          }}>
            {/* Swatch */}
            <div style={{ width: 28, height: 28, borderRadius: 6, background: c.hex, border: "1px solid var(--border-hi)" }} />

            <span style={{ fontSize: 14 }}>{c.name}</span>
            <span className="font-mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{c.hex}</span>

            {/* Toggle */}
            <button
              onClick={() => toggle(c.id, c.available)}
              disabled={loading === c.id}
              style={{
                background: "transparent",
                border: `1px solid ${c.available ? "rgba(0,229,160,0.3)" : "rgba(255,90,90,0.3)"}`,
                borderRadius: 6, padding: "4px 12px", cursor: "pointer",
                color: c.available ? "var(--green)" : "var(--red)",
                fontSize: 12, fontFamily: "var(--font-mono)",
                letterSpacing: "0.05em"
              }}
            >
              {c.available ? "● Available" : "○ Unavailable"}
            </button>

            <button
              onClick={() => deleteColour(c.id)}
              disabled={!!loading}
              style={{
                background: "transparent", border: "none",
                color: "var(--muted)", cursor: "pointer", fontSize: 12,
                padding: "4px 8px", borderRadius: 4
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--red)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
            >
              Remove
            </button>
          </div>
        ))}

        {colours.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
            No colours yet. Add one below.
          </div>
        )}
      </div>

      {/* Add new */}
      <div className="card">
        <p className="eyebrow" style={{ marginBottom: 16 }}>Add New Colour</p>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 160 }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Colour name</span>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="input-field"
              placeholder="e.g. Purple"
              onKeyDown={e => e.key === "Enter" && addColour()}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Hex colour</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                value={newHex}
                onChange={e => setNewHex(e.target.value)}
                style={{ width: 44, height: 44, borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", padding: 2, background: "var(--bg2)" }}
              />
              <input
                value={newHex}
                onChange={e => setNewHex(e.target.value)}
                className="input-field"
                style={{ width: 100, fontFamily: "monospace" }}
              />
            </div>
          </label>
          <button
            onClick={addColour}
            disabled={loading === "add"}
            className="btn-primary"
            style={{ flexShrink: 0 }}
          >
            {loading === "add" ? "Adding..." : "Add Colour"}
          </button>
        </div>
      </div>
    </div>
  );
}

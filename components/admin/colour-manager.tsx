"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ALL_MATERIALS = ["PLA", "ABS", "PETG"] as const;
type Material = typeof ALL_MATERIALS[number];

type Colour = {
  id: string;
  name: string;
  hex: string;
  available: boolean;
  sort_order: number;
  materials: string[] | null;
};

export default function ColourManager({ initialColours }: { initialColours: Colour[] }) {
  const [colours, setColours] = useState(initialColours);
  const [newName, setNewName] = useState("");
  const [newHex, setNewHex] = useState("#888888");
  const [newMaterials, setNewMaterials] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  async function toggleAvailable(id: string, available: boolean) {
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

  async function toggleMaterial(id: string, mat: Material, currentMaterials: string[] | null) {
    const base = currentMaterials ?? ALL_MATERIALS.slice();
    const next = base.includes(mat) ? base.filter(m => m !== mat) : [...base, mat];
    const toStore = next.length === ALL_MATERIALS.length ? null : next;
    setLoading(id + "-mat");
    setError("");
    const res = await fetch("/api/admin/colours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, materials: toStore }),
    });
    if (!res.ok) { setError("Failed to update materials."); }
    else { setColours(c => c.map(x => x.id === id ? { ...x, materials: toStore } : x)); }
    setLoading(null);
  }

  async function addColour() {
    if (!newName.trim()) { setError("Name is required."); return; }
    setLoading("add");
    setError("");
    const materialsToStore = newMaterials.length === 0 || newMaterials.length === ALL_MATERIALS.length ? null : newMaterials;
    const res = await fetch("/api/admin/colours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), hex: newHex, materials: materialsToStore }),
    });
    if (!res.ok) { setError("Failed to add colour."); }
    else { setNewName(""); setNewHex("#888888"); setNewMaterials([]); router.refresh(); }
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

  function isMaterialActive(c: Colour, mat: Material) {
    return c.materials === null || c.materials.includes(mat);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && <div className="error-box">{error}</div>}

      <p style={{ fontSize: 12, color: "var(--text-dim)", margin: 0 }}>
        Click material badges to control which materials each colour is available for. Greyed badges mean that colour won't appear as selectable for that material on the quote form.
      </p>

      {/* Colour list */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "40px 1fr 90px 190px 110px 80px",
          gap: 12, padding: "12px 20px",
          background: "var(--bg2)", borderBottom: "1px solid var(--border)"
        }}>
          {["", "Colour", "Hex", "Materials", "Status", ""].map((h, i) => (
            <span key={i} className="font-mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</span>
          ))}
        </div>

        {colours.map(c => (
          <div key={c.id} style={{
            display: "grid", gridTemplateColumns: "40px 1fr 90px 190px 110px 80px",
            gap: 12, padding: "14px 20px",
            borderBottom: "1px solid var(--border)",
            alignItems: "center",
            opacity: (loading === c.id || loading === c.id + "-mat") ? 0.5 : 1
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: c.hex, border: "1px solid var(--border-hi)" }} />
            <span style={{ fontSize: 14 }}>{c.name}</span>
            <span className="font-mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{c.hex}</span>

            {/* Per-material toggles */}
            <div style={{ display: "flex", gap: 5 }}>
              {ALL_MATERIALS.map(mat => {
                const active = isMaterialActive(c, mat);
                return (
                  <button key={mat} onClick={() => toggleMaterial(c.id, mat, c.materials)}
                    disabled={loading === c.id + "-mat"}
                    title={active ? `Click to remove from ${mat}` : `Click to add to ${mat}`}
                    style={{
                      fontSize: 11, fontFamily: "var(--font-mono)",
                      padding: "3px 8px", borderRadius: 5,
                      border: `1px solid ${active ? "rgba(249,115,22,0.5)" : "var(--border)"}`,
                      background: active ? "rgba(249,115,22,0.12)" : "transparent",
                      color: active ? "var(--orange)" : "var(--muted)",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >{mat}</button>
                );
              })}
            </div>

            <button onClick={() => toggleAvailable(c.id, c.available)} disabled={loading === c.id}
              style={{
                background: "transparent",
                border: `1px solid ${c.available ? "rgba(0,229,160,0.3)" : "rgba(255,90,90,0.3)"}`,
                borderRadius: 6, padding: "4px 12px", cursor: "pointer",
                color: c.available ? "var(--green)" : "var(--red)",
                fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.05em"
              }}
            >
              {c.available ? "● Available" : "○ Disabled"}
            </button>

            <button onClick={() => deleteColour(c.id)} disabled={!!loading}
              style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 12, padding: "4px 8px", borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--red)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
            >Remove</button>
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
            <input value={newName} onChange={e => setNewName(e.target.value)} className="input-field"
              placeholder="e.g. Purple" onKeyDown={e => e.key === "Enter" && addColour()} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Hex colour</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={newHex} onChange={e => setNewHex(e.target.value)}
                style={{ width: 44, height: 44, borderRadius: 8, border: "1px solid var(--border)", cursor: "pointer", padding: 2, background: "var(--bg2)" }} />
              <input value={newHex} onChange={e => setNewHex(e.target.value)} className="input-field" style={{ width: 100, fontFamily: "monospace" }} />
            </div>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Restrict to materials (none = all)</span>
            <div style={{ display: "flex", gap: 6 }}>
              {ALL_MATERIALS.map(mat => {
                const on = newMaterials.includes(mat);
                return (
                  <button key={mat} type="button"
                    onClick={() => setNewMaterials(p => on ? p.filter(m => m !== mat) : [...p, mat])}
                    style={{
                      fontSize: 11, fontFamily: "var(--font-mono)", padding: "6px 12px", borderRadius: 5,
                      border: `1px solid ${on ? "rgba(249,115,22,0.5)" : "var(--border)"}`,
                      background: on ? "rgba(249,115,22,0.12)" : "transparent",
                      color: on ? "var(--orange)" : "var(--muted)",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                  >{mat}</button>
                );
              })}
            </div>
          </label>
          <button onClick={addColour} disabled={loading === "add"} className="btn-primary" style={{ flexShrink: 0 }}>
            {loading === "add" ? "Adding..." : "Add Colour"}
          </button>
        </div>
      </div>
    </div>
  );
}

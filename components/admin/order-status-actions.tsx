"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACTIONS = [
  { label: "Mark as Printing", status: "printing", color: "var(--amber)" },
  { label: "Mark as Completed", status: "completed", color: "var(--green)" },
  { label: "Mark as Cancelled", status: "cancelled", color: "var(--red)" },
] as const;

export default function OrderStatusActions({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const router = useRouter();

  async function updateStatus(status: string) {
    try {
      setLoading(status);
      setError("");
      const res = await fetch("/api/admin/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status, note: note || undefined })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setLoading(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Note (optional — sent to customer)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input-field"
            style={{ resize: "vertical", minHeight: 72, fontSize: 13 }}
            placeholder="e.g. Your print is queued for tomorrow morning..."
          />
        </label>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ACTIONS.map((action) => (
          <button
            key={action.status}
            onClick={() => updateStatus(action.status)}
            disabled={loading !== null}
            style={{
              background: "transparent",
              border: `1px solid ${action.color}22`,
              borderRadius: 8,
              padding: "10px 16px",
              color: action.color,
              fontSize: 13,
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.15s",
              opacity: loading !== null ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
            onMouseEnter={e => (e.currentTarget.style.background = `${action.color}11`)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span>{loading === action.status ? "Updating..." : action.label}</span>
            <span style={{ opacity: 0.4 }}>→</span>
          </button>
        ))}
      </div>

      {error && <div className="error-box">{error}</div>}

      <hr className="divider" />

      <button onClick={logout} className="btn-danger" style={{ fontSize: 12, padding: "8px 16px" }}>
        Log out
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      setLoading(true);
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Incorrect password.");
      router.push("/admin/orders");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card-accent corner-accent" style={{ width: "100%", maxWidth: 380 }}>
        <p className="eyebrow" style={{ marginBottom: 20 }}>Secure Access</p>
        <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Login</h1>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 28 }}>Enter your password to continue.</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              autoFocus
            />
          </label>

          {error && <div className="error-box">{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", marginTop: 4 }}>
            {loading ? "Verifying..." : "Sign In →"}
          </button>
        </form>
      </div>
    </div>
  );
}

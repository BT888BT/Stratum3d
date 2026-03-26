import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stratum3D — Professional 3D Printing",
  description: "Upload your model, get an instant quote, place your order."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=1280, initial-scale=1" />
      </head>
      <body>
        <div className="min-h-screen" style={{ background: "var(--bg)" }}>
          {/* Header */}
          <header style={{
            borderBottom: "1px solid var(--border)",
            background: "rgba(8,10,15,0.85)",
            backdropFilter: "blur(12px)",
            position: "sticky",
            top: 0,
            zIndex: 50
          }}>
            <div style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "0 24px",
              height: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Logo mark */}
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" stroke="var(--accent)" strokeWidth="1.5" fill="none"/>
                  <polygon points="14,7 21,11 21,17 14,21 7,17 7,11" stroke="var(--accent)" strokeWidth="1" fill="rgba(0,212,255,0.05)"/>
                  <line x1="14" y1="2" x2="14" y2="7" stroke="var(--accent)" strokeWidth="1" opacity="0.5"/>
                  <line x1="26" y1="8" x2="21" y2="11" stroke="var(--accent)" strokeWidth="1" opacity="0.5"/>
                  <line x1="26" y1="20" x2="21" y2="17" stroke="var(--accent)" strokeWidth="1" opacity="0.5"/>
                  <line x1="14" y1="26" x2="14" y2="21" stroke="var(--accent)" strokeWidth="1" opacity="0.5"/>
                  <line x1="2" y1="20" x2="7" y2="17" stroke="var(--accent)" strokeWidth="1" opacity="0.5"/>
                  <line x1="2" y1="8" x2="7" y2="11" stroke="var(--accent)" strokeWidth="1" opacity="0.5"/>
                </svg>
                <span className="font-display" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "0.05em", color: "var(--text)" }}>
                  STRATUM<span style={{ color: "var(--accent)" }}>3D</span>
                </span>
              </Link>

              <nav style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Link href="/quote" className="nav-link">
                  Get Quote
                </Link>
              </nav>
            </div>
          </header>

          <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px" }}>
            {children}
          </main>

          <footer style={{
            borderTop: "1px solid var(--border)",
            padding: "24px",
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 12,
            fontFamily: "var(--font-mono)"
          }}>
            <span className="font-mono">© {new Date().getFullYear()} STRATUM3D — PROFESSIONAL 3D PRINTING SERVICES</span>
          </footer>
        </div>
      </body>
    </html>
  );
}

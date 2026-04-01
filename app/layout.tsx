import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { SpeedInsights } from '@vercel/speed-insights/next';

export const metadata: Metadata = {
  title: "Stratum3D — Local 3D Printing",
  description: "Affordable local 3D printing for hobbyists and makers. Upload your STL, get an instant quote, and we'll print and ship it fast."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

          {/* Header */}
          <header style={{
            borderBottom: "1px solid var(--border)",
            background: "rgba(14,10,6,0.9)",
            backdropFilter: "blur(16px)",
            position: "sticky", top: 0, zIndex: 50
          }}>
            <div style={{
              maxWidth: 1200, margin: "0 auto",
              padding: "0 clamp(16px, 4vw, 32px)",
              height: 60,
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Hexagon logo */}
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                  <polygon points="16,2 29,9 29,23 16,30 3,23 3,9"
                    stroke="var(--orange)" strokeWidth="1.5" fill="rgba(249,115,22,0.08)"/>
                  <polygon points="16,8 23,12 23,20 16,24 9,20 9,12"
                    stroke="var(--orange)" strokeWidth="1" fill="rgba(249,115,22,0.12)" opacity="0.6"/>
                  <circle cx="16" cy="16" r="3" fill="var(--orange)" opacity="0.9"/>
                </svg>
                <span className="font-display" style={{ fontSize: 22, color: "var(--text)", letterSpacing: "0.06em" }}>
                  STRATUM<span style={{ color: "var(--orange)" }}>3D</span>
                </span>
              </Link>

              <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Link href="/quote" className="btn-primary" style={{ fontSize: 14, padding: "8px 20px" }}>
                  Get Quote
                </Link>
              </nav>
            </div>
          </header>

          <main style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(24px, 5vw, 48px) clamp(16px, 4vw, 32px)" }}>
            {children}
          </main>

          <footer style={{
            borderTop: "1px solid var(--border)",
            padding: "24px clamp(16px, 4vw, 32px)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 10
          }}>
            <div style={{ display: "flex", gap: 20 }}>
              <Link href="/privacy" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em" }}>Privacy Policy</Link>
              <Link href="/terms" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em" }}>Terms of Service</Link>
            </div>
            <span className="font-mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.15em" }}>
              © {new Date().getFullYear()} STRATUM3D — LOCAL 3D PRINTING SERVICES — AUSTRALIA
            </span>
          </footer>

        </div>
        <SpeedInsights />
      </body>
    </html>
  );
}

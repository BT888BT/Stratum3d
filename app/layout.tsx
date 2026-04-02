import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stratum3D — Affordable 3D Printing in Perth | Fast Local FDM Service",
  description: "Perth's affordable 3D printing service. PLA, PETG & ABS from $12. Upload your STL → instant quote → fast turnaround. Local pickup or shipping Australia-wide.",
  keywords: "3D printing Perth, 3D print service Perth, affordable 3D printing, FDM printing Perth, PLA printing Perth, hobby 3D printing Australia, 3D printing service Western Australia, custom 3D prints Perth, STL printing, local 3D printing, cheap 3D printing Perth",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "Stratum3D — Affordable 3D Printing in Perth",
    description: "Perth's affordable 3D printing. PLA, PETG & ABS from $12. Upload → quote → print. Fast local turnaround.",
    url: "https://www.stratum3d.com.au",
    siteName: "Stratum3D",
    locale: "en_AU",
    type: "website",
  },
  alternates: {
    canonical: "https://www.stratum3d.com.au",
  },
};

// Structured data for Google — LocalBusiness + 3D printing service
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Stratum3D",
  description: "Affordable local 3D printing service in Perth, Western Australia. FDM printing in PLA, PETG & ABS for hobbyists, makers and small projects.",
  url: "https://www.stratum3d.com.au",
  areaServed: {
    "@type": "State",
    name: "Western Australia",
    containedInPlace: { "@type": "Country", name: "Australia" },
  },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Perth",
    addressRegion: "WA",
    addressCountry: "AU",
  },
  priceRange: "$",
  serviceType: ["3D Printing", "FDM Printing", "Rapid Prototyping", "Custom 3D Prints"],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "3D Printing Materials",
    itemListElement: [
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "PLA 3D Printing" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "PETG 3D Printing" } },
      { "@type": "Offer", itemOffered: { "@type": "Service", name: "ABS 3D Printing" } },
    ],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="geo.region" content="AU-WA" />
        <meta name="geo.placename" content="Perth" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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

              <nav style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Link href="/gallery" style={{ fontSize: 13, color: "var(--text-dim)", textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "var(--text)")}
                  onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = "var(--text-dim)")}
                >Gallery</Link>
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
              <Link href="/guide" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em" }}>Print Guide</Link>
              <Link href="/privacy" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em" }}>Privacy Policy</Link>
              <Link href="/terms" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em" }}>Terms of Service</Link>
            </div>
            <span className="font-mono" style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.15em" }}>
              © {new Date().getFullYear()} STRATUM3D — LOCAL 3D PRINTING SERVICES — PERTH, AUSTRALIA
            </span>
          </footer>

        </div>
      </body>
    </html>
  );
}

import Link from "next/link";

const materials = [
  { name: "PLA", desc: "Ideal for prototypes & display models", temp: "190–220°C", strength: "Good" },
  { name: "PETG", desc: "Durable, slightly flexible, moisture resistant", temp: "230–250°C", strength: "Very Good" },
  { name: "ABS", desc: "Heat resistant, impact tough, machinable", temp: "230–260°C", strength: "Excellent" },
];

const steps = [
  { n: "01", title: "Upload Model", desc: "STL, OBJ, or 3MF — up to 50 MB" },
  { n: "02", title: "Get Instant Quote", desc: "Real-time pricing based on material, size & settings" },
  { n: "03", title: "Pay Securely", desc: "Stripe-powered checkout, AUD pricing with GST" },
  { n: "04", title: "Track Your Order", desc: "Email updates from printing through to delivery" },
];

export default function HomePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 80 }}>

      {/* Hero */}
      <section className="grid-bg" style={{
        borderRadius: 20,
        border: "1px solid var(--border)",
        padding: "72px 48px",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Glow blob */}
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 400, height: 400,
          background: "radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 70%)",
          pointerEvents: "none"
        }} />
        <div style={{ position: "relative", maxWidth: 640 }}>
          <p className="eyebrow fade-up" style={{ marginBottom: 20 }}>Professional 3D Printing</p>
          <h1 className="font-display fade-up-2" style={{
            fontSize: "clamp(36px, 5vw, 60px)",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            marginBottom: 24,
            color: "var(--text)"
          }}>
            Upload. Quote.<br />
            <span style={{ color: "var(--accent)" }}>Print.</span>
          </h1>
          <p className="fade-up-3" style={{ fontSize: 17, color: "var(--text-dim)", lineHeight: 1.7, marginBottom: 36, maxWidth: 500 }}>
            Professional FDM printing in PLA, PETG & ABS. Instant pricing, secure checkout, and real-time order tracking — all in one place.
          </p>
          <div className="fade-up-4" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/quote" className="btn-primary glow-pulse" style={{ fontSize: 13 }}>
              Start Your Quote →
            </Link>
            <a href="#how-it-works" className="btn-ghost">
              How it works
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works">
        <p className="eyebrow" style={{ marginBottom: 12 }}>Process</p>
        <h2 className="font-display" style={{ fontSize: 28, fontWeight: 600, marginBottom: 32 }}>How it works</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          {steps.map((s) => (
            <div key={s.n} className="card corner-accent" style={{ position: "relative" }}>
              <span className="font-mono" style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em" }}>{s.n}</span>
              <h3 className="font-display" style={{ fontSize: 17, fontWeight: 600, margin: "10px 0 8px", color: "var(--text)" }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Materials */}
      <section>
        <p className="eyebrow" style={{ marginBottom: 12 }}>Materials</p>
        <h2 className="font-display" style={{ fontSize: 28, fontWeight: 600, marginBottom: 32 }}>Available materials</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {materials.map((m) => (
            <div key={m.name} className="card" style={{
              borderColor: "var(--border-hi)",
              background: "linear-gradient(135deg, var(--surface) 0%, var(--bg2) 100%)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <span className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>{m.name}</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>{m.desc}</p>
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <p className="font-mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Print Temp</p>
                  <p className="font-mono" style={{ fontSize: 12, color: "var(--text)", marginTop: 2 }}>{m.temp}</p>
                </div>
                <div>
                  <p className="font-mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Strength</p>
                  <p className="font-mono" style={{ fontSize: 12, color: "var(--green)", marginTop: 2 }}>{m.strength}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        background: "linear-gradient(135deg, #0a1a20 0%, #0d1017 100%)",
        border: "1px solid rgba(0,212,255,0.15)",
        borderRadius: 16,
        padding: "48px",
        textAlign: "center"
      }}>
        <p className="eyebrow" style={{ marginBottom: 16 }}>Ready to print?</p>
        <h2 className="font-display" style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>Get your quote in seconds</h2>
        <p style={{ color: "var(--text-dim)", marginBottom: 32, fontSize: 15 }}>Upload your model and receive instant pricing — no sign-up required.</p>
        <Link href="/quote" className="btn-primary">
          Upload & Quote Now →
        </Link>
      </section>

    </div>
  );
}

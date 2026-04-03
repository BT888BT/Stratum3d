import Link from "next/link";

const materials = [
  { name: "PLA",  colour: "#fb923c", desc: "Great for hobby projects, display models & cosplay props", temp: "190–220°C", strength: "Good",      use: "Hobby / General" },
  { name: "PETG", colour: "#f97316", desc: "Durable, moisture resistant — ideal for outdoor or functional parts",          temp: "230–250°C", strength: "Very Good", use: "Functional" },
  { name: "ABS",  colour: "#ea580c", desc: "Heat resistant, impact tough — suited for mechanical or engineering use",             temp: "230–260°C", strength: "Excellent", use: "Engineering" },
];

const steps = [
  { n: "01", icon: "⬆", title: "Upload STL",       desc: "Drop one or more STL files — up to 50 MB each" },
  { n: "02", icon: "⚙", title: "Configure",        desc: "Pick material, colour, layer height and infill for each file" },
  { n: "03", icon: "💲", title: "Instant Quote",    desc: "Pricing calculated from your actual mesh volume — no hidden fees" },
  { n: "04", icon: "✓", title: "Pay & Track",      desc: "Secure checkout, then email updates until it's at your door" },
];

const perks = [
  { title: "Local & Australian", desc: "Based in Perth, WA — shorter shipping times, local support, no overseas delays" },
  { title: "Fast Turnaround", desc: "Most orders printed and shipped within a few business days" },
  { title: "Hobbyist Friendly", desc: "Low-cost pricing built for makers, hobbyists and small projects" },
  { title: "Honest Pricing", desc: "Pay for what you print — volume-based quotes with no minimum order" },
];

export default function HomePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "clamp(48px, 8vw, 96px)" }}>

      {/* ── Hero ── */}
      <section style={{ position: "relative", overflow: "hidden" }}>
        {/* Background glow */}
        <div style={{
          position: "absolute", top: "50%", right: "-10%",
          transform: "translateY(-50%)",
          width: "clamp(300px, 50vw, 600px)", height: "clamp(300px, 50vw, 600px)",
          background: "radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)",
          pointerEvents: "none"
        }} />

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "clamp(24px, 4vw, 48px)",
          alignItems: "center",
          padding: "clamp(40px, 6vw, 80px) clamp(24px, 4vw, 48px)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          position: "relative"
        }}>
          <div style={{ position: "relative", zIndex: 1 }}>
            <span className="eyebrow fade-up" style={{ marginBottom: 16, display: "block" }}>
              Local 3D Printing — Australia
            </span>
            <h1 className="font-display fade-up-2" style={{
              fontSize: "clamp(52px, 8vw, 100px)",
              lineHeight: 0.95,
              marginBottom: "clamp(16px, 3vw, 28px)",
              color: "var(--text)"
            }}>
              UPLOAD.<br />
              QUOTE.<br />
              <span style={{ color: "var(--orange)", WebkitTextStroke: "1px var(--orange-hi)" }}>PRINT.</span>
            </h1>
            <p className="fade-up-3" style={{
              fontSize: "clamp(14px, 1.8vw, 17px)",
              color: "var(--text-dim)",
              lineHeight: 1.75,
              maxWidth: 480,
              marginBottom: "clamp(24px, 4vw, 40px)"
            }}>
              Affordable FDM printing for hobbyists and makers in Perth. PLA, PETG & ABS — priced from your actual mesh volume with fast local turnaround.
            </p>
            <div className="fade-up-4" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/quote" className="btn-primary glow-pulse" style={{ fontSize: 16 }}>
                Get a Quote →
              </Link>
              <a href="#how-it-works" className="btn-ghost">How it works</a>
            </div>
          </div>

          {/* 3D visual — hidden on small screens */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
            className="hidden-mobile">
            <div style={{ perspective: 800 }}>
              <div className="float-anim" style={{ width: 160, height: 160, position: "relative", transformStyle: "preserve-3d" }}>
                {/* Outer cube */}
                {["front","back","left","right","top","bottom"].map(face => (
                  <div key={face} style={{
                    position: "absolute", width: 160, height: 160,
                    border: "1.5px solid rgba(249,115,22,0.5)",
                    background: "rgba(249,115,22,0.03)",
                    transform: {
                      front:  "translateZ(80px)",
                      back:   "rotateY(180deg) translateZ(80px)",
                      left:   "rotateY(-90deg) translateZ(80px)",
                      right:  "rotateY(90deg) translateZ(80px)",
                      top:    "rotateX(90deg) translateZ(80px)",
                      bottom: "rotateX(-90deg) translateZ(80px)",
                    }[face]
                  }} />
                ))}
                {/* Inner cube */}
                {["front","back","left","right","top","bottom"].map(face => (
                  <div key={`i-${face}`} style={{
                    position: "absolute",
                    width: 80, height: 80,
                    top: 40, left: 40,
                    border: "1px solid rgba(249,115,22,0.8)",
                    background: "rgba(249,115,22,0.08)",
                    transform: {
                      front:  "translateZ(40px)",
                      back:   "rotateY(180deg) translateZ(40px)",
                      left:   "rotateY(-90deg) translateZ(40px)",
                      right:  "rotateY(90deg) translateZ(40px)",
                      top:    "rotateX(90deg) translateZ(40px)",
                      bottom: "rotateX(-90deg) translateZ(40px)",
                    }[face]
                  }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Layer lines visual below hero */}
        <div style={{ marginTop: 12, padding: "12px 24px", display: "flex", alignItems: "center", gap: 16 }}>
          <span className="eyebrow" style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>Printing</span>
          <div className="layer-visual" style={{ flex: 1 }}>
            {[100,85,92,70,88,95,60,78].map((w, i) => (
              <div key={i} className="layer-line" style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
          <span className="font-mono" style={{ fontSize: 10, color: "var(--orange)", whiteSpace: "nowrap" }}>Layer by layer</span>
        </div>
      </section>

      {/* ── Why Stratum3D ── */}
      <section>
        <span className="eyebrow" style={{ marginBottom: 12 }}>Why Us</span>
        <h2 className="font-display" style={{ fontSize: "clamp(32px, 5vw, 52px)", marginBottom: "clamp(12px, 2vw, 20px)" }}>
          BUILT FOR MAKERS
        </h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: 12
        }}>
          {perks.map((p) => (
            <div key={p.title} className="card">
              <h3 className="font-display" style={{ fontSize: 20, color: "var(--orange)", marginBottom: 8 }}>{p.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.65 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works">
        <span className="eyebrow" style={{ marginBottom: 12 }}>Process</span>
        <h2 className="font-display" style={{ fontSize: "clamp(32px, 5vw, 52px)", marginBottom: "clamp(12px, 2vw, 20px)" }}>
          HOW IT WORKS
        </h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: 12
        }}>
          {steps.map((s) => (
            <div key={s.n} className="card" style={{ position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute", top: -8, right: -4,
                fontFamily: "Bebas Neue, sans-serif",
                fontSize: 72, color: "rgba(249,115,22,0.06)",
                lineHeight: 1, letterSpacing: "0.04em",
                pointerEvents: "none"
              }}>{s.n}</div>
              <div style={{ fontSize: 24, marginBottom: 12 }}>{s.icon}</div>
              <h3 className="font-display" style={{ fontSize: 22, color: "var(--orange)", marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.65 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Materials ── */}
      <section>
        <span className="eyebrow" style={{ marginBottom: 12 }}>Materials</span>
        <h2 className="font-display" style={{ fontSize: "clamp(32px, 5vw, 52px)", marginBottom: "clamp(12px, 2vw, 20px)" }}>
          AVAILABLE MATERIALS
        </h2>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 12
        }}>
          {materials.map((m) => (
            <div key={m.name} className="card" style={{
              borderColor: "var(--border-hi)",
              background: `linear-gradient(135deg, rgba(249,115,22,0.05) 0%, var(--surface) 100%)`
            }}>
              {/* 3D layer icon */}
              <div style={{ marginBottom: 16 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{
                    height: 6, borderRadius: 3, marginBottom: 3,
                    background: m.colour, opacity: 1.1 - i * 0.25,
                    width: `${100 - (i - 1) * 15}%`
                  }} />
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                <span className="font-display" style={{ fontSize: 32, color: m.colour }}>{m.name}</span>
                <span className="font-mono" style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{m.use}</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 16 }}>{m.desc}</p>
              <div style={{ display: "flex", gap: 20 }}>
                <div>
                  <p className="font-mono" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Print Temp</p>
                  <p className="font-mono" style={{ fontSize: 12, color: "var(--text)", marginTop: 2 }}>{m.temp}</p>
                </div>
                <div>
                  <p className="font-mono" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Strength</p>
                  <p className="font-mono" style={{ fontSize: 12, color: "var(--green)", marginTop: 2 }}>{m.strength}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        background: "linear-gradient(135deg, #1a0800 0%, var(--surface) 100%)",
        border: "1px solid rgba(249,115,22,0.2)",
        borderRadius: 16,
        padding: "clamp(32px, 5vw, 64px) clamp(24px, 4vw, 48px)",
        textAlign: "center",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at center, rgba(249,115,22,0.08) 0%, transparent 70%)",
          pointerEvents: "none"
        }} />
        <span className="eyebrow" style={{ marginBottom: 16 }}>Ready?</span>
        <h2 className="font-display" style={{ fontSize: "clamp(40px, 6vw, 72px)", marginBottom: 16 }}>
          GET YOUR QUOTE IN SECONDS
        </h2>
        <p style={{ color: "var(--text-dim)", marginBottom: "clamp(24px, 4vw, 40px)", fontSize: "clamp(13px, 1.5vw, 16px)", maxWidth: 480, margin: "0 auto clamp(24px, 4vw, 40px)" }}>
          Upload your STL, pick your settings, and get an instant price. Affordable local printing with fast turnaround.
        </p>
        <Link href="/quote" className="btn-primary glow-pulse" style={{ fontSize: 18 }}>
          Upload & Quote Now →
        </Link>
      </section>

    </div>
  );
}

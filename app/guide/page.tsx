import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "3D Print Settings Guide — Stratum3D | Perth 3D Printing",
  description: "Learn about 3D print settings: layer height, infill, materials, and support removal. A simple guide for hobbyists and beginners ordering 3D prints in Perth, Australia.",
  keywords: "3D printing guide, layer height explained, infill percentage, PLA vs PETG vs ABS, 3D printing Perth, beginner 3D printing, FDM printing settings",
};

function Visual({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg2)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "20px 24px", margin: "16px 0",
      display: "flex", justifyContent: "center"
    }}>
      {children}
    </div>
  );
}

function Section({ id, icon, title, children }: { id: string; icon: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <h2 className="font-display" style={{ fontSize: "clamp(24px, 4vw, 32px)", color: "var(--text)" }}>{title}</h2>
      </div>
      <div style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.8 }}>
        {children}
      </div>
    </section>
  );
}

export default function GuidePage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link href="/quote" style={{ fontSize: 12, color: "var(--text-dim)", display: "inline-block", marginBottom: 16 }}>← Back to quote</Link>
      <span className="eyebrow" style={{ marginBottom: 10 }}>Print Settings Guide</span>
      <h1 className="font-display" style={{ fontSize: "clamp(32px, 5vw, 48px)", marginBottom: 8 }}>UNDERSTANDING YOUR PRINT</h1>
      <p style={{ fontSize: 14, color: "var(--text-dim)", marginBottom: 40, lineHeight: 1.7 }}>
        New to 3D printing? This guide explains each setting so you can make the right choices for your project. If you&apos;re unsure, the defaults (PLA, 0.20mm layer, 20% infill) work well for most hobby prints.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 48 }}>

        {/* ── Layer Height ── */}
        <Section id="layer-height" icon="📐" title="LAYER HEIGHT">
          <p>Layer height is the thickness of each horizontal layer the printer puts down. Think of it like slicing a loaf of bread — thinner slices give more detail, thicker slices are faster.</p>

          <Visual>
            <div style={{ display: "flex", gap: 32, alignItems: "flex-end" }}>
              {[
                { label: "0.10mm Fine", count: 16, color: "var(--orange)" },
                { label: "0.20mm Standard", count: 8, color: "var(--orange)" },
                { label: "0.30mm Draft", count: 5, color: "var(--orange)" },
              ].map(opt => (
                <div key={opt.label} style={{ textAlign: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "center" }}>
                    {Array.from({ length: opt.count }).map((_, i) => (
                      <div key={i} style={{
                        width: 50, height: Math.max(2, 40 / opt.count),
                        background: opt.color,
                        opacity: 0.4 + (i / opt.count) * 0.6,
                        borderRadius: 1,
                      }} />
                    ))}
                  </div>
                  <p className="font-mono" style={{ fontSize: 9, color: "var(--muted)", marginTop: 8 }}>{opt.label}</p>
                </div>
              ))}
            </div>
          </Visual>

          <p><strong style={{ color: "var(--text)" }}>0.10mm — Fine:</strong> Smoothest surface, barely visible layers. Best for detailed models, figurines, or display pieces. Takes the longest to print.</p>
          <p><strong style={{ color: "var(--text)" }}>0.15mm — High:</strong> Good balance of detail and speed. Great for most hobby prints.</p>
          <p><strong style={{ color: "var(--text)" }}>0.20mm — Standard:</strong> The default. Layers are visible up close but fine for functional parts, prototypes, and general use. Most popular choice.</p>
          <p><strong style={{ color: "var(--text)" }}>0.30mm — Draft:</strong> Fastest print, most visible layers. Good for testing fit or when appearance doesn&apos;t matter.</p>
        </Section>

        {/* ── Infill ── */}
        <Section id="infill" icon="🔲" title="INFILL PERCENTAGE">
          <p>Infill is the internal structure inside your print. A 100% infill part is completely solid, while lower percentages use a honeycomb-like pattern inside, saving material and time.</p>

          <Visual>
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              {[
                { label: "10%", density: 0.1 },
                { label: "20%", density: 0.2 },
                { label: "50%", density: 0.5 },
                { label: "100%", density: 1.0 },
              ].map(opt => (
                <div key={opt.label} style={{ textAlign: "center" }}>
                  <div style={{
                    width: 56, height: 56,
                    border: "2px solid var(--orange)",
                    borderRadius: 6,
                    position: "relative",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      position: "absolute", inset: 2,
                      background: `repeating-linear-gradient(45deg, transparent, transparent ${Math.round((1 - opt.density) * 8 + 1)}px, rgba(249,115,22,0.4) ${Math.round((1 - opt.density) * 8 + 1)}px, rgba(249,115,22,0.4) ${Math.round((1 - opt.density) * 8 + 2)}px)`,
                      opacity: opt.density === 1 ? 0 : 1,
                    }} />
                    {opt.density === 1 && (
                      <div style={{ position: "absolute", inset: 2, background: "rgba(249,115,22,0.5)", borderRadius: 3 }} />
                    )}
                  </div>
                  <p className="font-mono" style={{ fontSize: 9, color: "var(--muted)", marginTop: 6 }}>{opt.label}</p>
                </div>
              ))}
            </div>
          </Visual>

          <p><strong style={{ color: "var(--text)" }}>10–15%:</strong> Light and fast. Fine for decorative items, display models, or anything that won&apos;t bear load.</p>
          <p><strong style={{ color: "var(--text)" }}>20%:</strong> The default. Good all-round strength for most hobby prints. This is what we recommend if you&apos;re unsure.</p>
          <p><strong style={{ color: "var(--text)" }}>30–50%:</strong> Stronger. Use for parts that need to handle some force — brackets, mounts, enclosures.</p>
          <p><strong style={{ color: "var(--text)" }}>75–100%:</strong> Very strong and heavy. Solid or near-solid. Only needed for mechanical/structural parts under real stress.</p>
        </Section>

        {/* ── Material ── */}
        <Section id="material" icon="🧱" title="MATERIAL">
          <p>We offer three FDM filament types. Each has different properties suited to different uses.</p>

          <Visual>
            <div style={{ display: "flex", gap: 16, width: "100%" }}>
              {[
                { name: "PLA", colour: "#fb923c", traits: ["Easy to print", "Biodegradable", "Low heat resistance", "Best for hobby & display"] },
                { name: "PETG", colour: "#f97316", traits: ["Strong & flexible", "Moisture resistant", "Food-safe variants", "Best for functional parts"] },
                { name: "ABS", colour: "#ea580c", traits: ["Heat resistant", "Impact tough", "Can be sanded/glued", "Best for engineering"] },
              ].map(m => (
                <div key={m.name} style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                  <p className="font-display" style={{ fontSize: 20, color: m.colour, marginBottom: 8 }}>{m.name}</p>
                  {m.traits.map(t => (
                    <p key={t} style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.6, margin: 0 }}>· {t}</p>
                  ))}
                </div>
              ))}
            </div>
          </Visual>

          <p><strong style={{ color: "var(--text)" }}>PLA</strong> is the most popular choice for hobbyists. It&apos;s affordable, easy to print, and comes in many colours. Perfect for display models, cosplay props, figurines, and prototypes. It&apos;s not great in heat (softens above ~55°C) so don&apos;t leave PLA prints in a hot car.</p>
          <p><strong style={{ color: "var(--text)" }}>PETG</strong> is tougher and slightly flexible. It handles moisture and chemicals better than PLA. Use it for outdoor items, water-adjacent parts, or anything that needs more durability.</p>
          <p><strong style={{ color: "var(--text)" }}>ABS</strong> is the strongest option. It&apos;s heat resistant, impact tough, and can be sanded or acetone-smoothed for a polished finish. Best for mechanical parts, enclosures, or anything that needs to survive rough handling.</p>
        </Section>

        {/* ── Supports ── */}
        <Section id="supports" icon="🏗️" title="SUPPORT MATERIAL">
          <p>3D printers build layer by layer from bottom to top. If your model has overhangs or bridges (parts that stick out with nothing underneath), the printer adds temporary support structures to hold those sections up during printing.</p>

          <Visual>
            <div style={{ display: "flex", gap: 40, alignItems: "flex-end" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ position: "relative", width: 70, height: 70 }}>
                  {/* T-shape model */}
                  <div style={{ position: "absolute", top: 0, left: 5, right: 5, height: 20, background: "var(--orange)", borderRadius: "4px 4px 0 0" }} />
                  <div style={{ position: "absolute", top: 20, left: 25, width: 20, height: 50, background: "var(--orange)", borderRadius: "0 0 4px 4px" }} />
                  {/* Support lines */}
                  <div style={{ position: "absolute", top: 20, left: 5, width: 20, height: 50, background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(249,115,22,0.2) 3px, rgba(249,115,22,0.2) 4px)", borderRadius: 2 }} />
                  <div style={{ position: "absolute", top: 20, right: 5, width: 20, height: 50, background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(249,115,22,0.2) 3px, rgba(249,115,22,0.2) 4px)", borderRadius: 2 }} />
                </div>
                <p className="font-mono" style={{ fontSize: 9, color: "var(--muted)", marginTop: 8 }}>With supports</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ position: "relative", width: 70, height: 70 }}>
                  <div style={{ position: "absolute", top: 0, left: 5, right: 5, height: 20, background: "var(--orange)", borderRadius: "4px 4px 0 0" }} />
                  <div style={{ position: "absolute", top: 20, left: 25, width: 20, height: 50, background: "var(--orange)", borderRadius: "0 0 4px 4px" }} />
                </div>
                <p className="font-mono" style={{ fontSize: 9, color: "var(--green)", marginTop: 8 }}>Supports removed</p>
              </div>
            </div>
          </Visual>

          <p>After printing, these supports need to be snapped or cut off. You have two options:</p>
          <p><strong style={{ color: "var(--text)" }}>Leave supports on (default):</strong> We ship the part as-printed with supports attached. You break them off yourself — it&apos;s usually easy with pliers or by hand. This is the cheapest and fastest option.</p>
          <p><strong style={{ color: "var(--text)" }}>Remove supports (+ 20%):</strong> We carefully remove all support material and clean up the part before shipping. The surface where supports were attached may show minor marks, but the part is ready to use out of the box.</p>
        </Section>

        {/* ── Colour ── */}
        <Section id="colour" icon="🎨" title="COLOUR">
          <p>We stock a range of filament colours that you can browse on the quote page. The colour you see on screen is a close representation but may vary slightly from the physical filament — this is normal with 3D printing. If exact colour matching is critical, reach out to us before ordering.</p>
        </Section>

        {/* ── Quick recommendations ── */}
        <Section id="recommendations" icon="💡" title="QUICK RECOMMENDATIONS">
          <div style={{
            background: "var(--bg2)", border: "1px solid var(--border-hi)", borderRadius: 10, padding: 20,
            display: "flex", flexDirection: "column", gap: 14
          }}>
            {[
              { use: "Display model / figurine", settings: "PLA · 0.10–0.15mm · 15% infill" },
              { use: "Cosplay prop", settings: "PLA · 0.20mm · 15–20% infill" },
              { use: "Phone case / enclosure", settings: "PETG · 0.20mm · 30% infill" },
              { use: "Bracket / mount", settings: "PETG or ABS · 0.20mm · 40–50% infill" },
              { use: "Quick prototype / test fit", settings: "PLA · 0.30mm · 10% infill" },
              { use: "Mechanical / structural part", settings: "ABS · 0.15–0.20mm · 75–100% infill" },
            ].map(r => (
              <div key={r.use} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text)" }}>{r.use}</span>
                <span className="font-mono" style={{ fontSize: 11, color: "var(--orange)", whiteSpace: "nowrap" }}>{r.settings}</span>
              </div>
            ))}
          </div>
        </Section>

      </div>

      <div style={{ marginTop: 48, textAlign: "center" }}>
        <Link href="/quote" className="btn-primary" style={{ fontSize: 16 }}>
          Start Your Quote →
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  quoteInputSchema,
  type QuoteInput,
  type QuoteInputParsed
} from "@/lib/validation";
import { formatAud } from "@/lib/utils";

type QuoteApiResponse = {
  orderId: string;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  gstCents: number;
  materialCostCents: number;
  machineCostCents: number;
  setupFeeCents: number;
  estimatedVolumeCm3: number;
  estimatedWeightGrams: number;
  estimatedPrintTimeMinutes: number;
};

const LAYER_OPTIONS = [
  { value: 0.1, label: "0.10 mm — Fine detail" },
  { value: 0.15, label: "0.15 mm — High quality" },
  { value: 0.2, label: "0.20 mm — Standard" },
  { value: 0.3, label: "0.30 mm — Draft / fast" },
];

const INFILL_OPTIONS = [10, 15, 20, 30, 40, 50, 75, 100];

const COLOURS = ["Black", "White", "Grey", "Red", "Blue", "Green", "Yellow", "Orange", "Natural"];

export default function QuoteForm() {
  const [file, setFile] = useState<File | null>(null);
  const [quote, setQuote] = useState<QuoteApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<QuoteInput, unknown, QuoteInputParsed>({
    resolver: zodResolver(quoteInputSchema),
    defaultValues: {
      customerName: "",
      email: "",
      phone: "",
      material: "PLA",
      colour: "Black",
      quantity: 1,
      layerHeightMm: 0.2,
      infillPercent: 20,
      approxXmm: 100,
      approxYmm: 100,
      approxZmm: 100,
      shippingMethod: "standard"
    }
  });

  async function onSubmit(values: QuoteInput) {
    setError(null);
    setQuote(null);
    if (!file) { setError("Please upload your 3D model file."); return; }

    try {
      setLoadingQuote(true);
      const formData = new FormData();
      Object.entries(values).forEach(([k, v]) => formData.append(k, String(v)));
      formData.append("file", file);

      const res = await fetch("/api/quote", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create quote.");
      setQuote(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quote.");
    } finally {
      setLoadingQuote(false);
    }
  }

  async function startCheckout() {
    if (!quote) return;
    try {
      setLoadingCheckout(true);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: quote.orderId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create checkout session.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout.");
    } finally {
      setLoadingCheckout(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>

      {/* ── Form ── */}
      <form onSubmit={handleSubmit(onSubmit)} className="card-lg" style={{ display: "flex", flexDirection: "column", gap: 28 }}>

        {/* Contact */}
        <div>
          <p className="eyebrow" style={{ marginBottom: 16 }}>Contact Details</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Full name" error={errors.customerName?.message}>
              <input {...register("customerName")} className="input-field" placeholder="Jane Smith" />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input {...register("email")} type="email" className="input-field" placeholder="jane@example.com" />
            </Field>
            <Field label="Phone (optional)" error={errors.phone?.message}>
              <input {...register("phone")} className="input-field" placeholder="+61 4xx xxx xxx" />
            </Field>
          </div>
        </div>

        <hr className="divider" />

        {/* Material */}
        <div>
          <p className="eyebrow" style={{ marginBottom: 16 }}>Material & Colour</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Material" error={errors.material?.message}>
              <select {...register("material")} className="input-field">
                <option value="PLA">PLA — Standard</option>
                <option value="PETG">PETG — Durable</option>
                <option value="ABS">ABS — Heat resistant</option>
              </select>
            </Field>
            <Field label="Colour" error={errors.colour?.message}>
              <select {...register("colour")} className="input-field">
                {COLOURS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
        </div>

        <hr className="divider" />

        {/* Print settings */}
        <div>
          <p className="eyebrow" style={{ marginBottom: 16 }}>Print Settings</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <Field label="Layer height" error={errors.layerHeightMm?.message}>
              <select {...register("layerHeightMm")} className="input-field">
                {LAYER_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Infill %" error={errors.infillPercent?.message}>
              <select {...register("infillPercent")} className="input-field">
                {INFILL_OPTIONS.map(v => (
                  <option key={v} value={v}>{v}%{v === 20 ? " (standard)" : v >= 50 ? " (solid)" : ""}</option>
                ))}
              </select>
            </Field>
            <Field label="Quantity" error={errors.quantity?.message}>
              <input type="number" min={1} max={100} {...register("quantity")} className="input-field" />
            </Field>
          </div>
        </div>

        <hr className="divider" />

        {/* Dimensions */}
        <div>
          <p className="eyebrow" style={{ marginBottom: 4 }}>Bounding Box Dimensions</p>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 16 }}>
            Approximate outer dimensions of your model in millimetres
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <Field label="X — Width (mm)" error={errors.approxXmm?.message}>
              <input type="number" step="0.1" {...register("approxXmm")} className="input-field" />
            </Field>
            <Field label="Y — Depth (mm)" error={errors.approxYmm?.message}>
              <input type="number" step="0.1" {...register("approxYmm")} className="input-field" />
            </Field>
            <Field label="Z — Height (mm)" error={errors.approxZmm?.message}>
              <input type="number" step="0.1" {...register("approxZmm")} className="input-field" />
            </Field>
          </div>
        </div>

        <hr className="divider" />

        {/* File + shipping */}
        <div>
          <p className="eyebrow" style={{ marginBottom: 16 }}>File & Delivery</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Shipping method" error={errors.shippingMethod?.message}>
              <select {...register("shippingMethod")} className="input-field">
                <option value="standard">Standard shipping (+$15.00)</option>
                <option value="pickup">Pickup — free</option>
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 13, color: "var(--text-dim)", display: "block", marginBottom: 6 }}>
                3D Model file <span style={{ color: "var(--accent)" }}>*</span>
              </span>
              <input
                type="file"
                accept=".stl,.obj,.3mf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="input-field"
                style={{ cursor: "pointer", fontSize: 13 }}
              />
              <span style={{ fontSize: 11, color: "var(--muted)", display: "block", marginTop: 4 }}>
                Accepted: STL, OBJ, 3MF — max 50 MB
              </span>
            </label>
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        <button type="submit" disabled={loadingQuote} className="btn-primary" style={{ width: "100%" }}>
          {loadingQuote ? "Calculating quote..." : "Calculate Quote →"}
        </button>
      </form>

      {/* ── Quote Summary ── */}
      <div style={{ position: "sticky", top: 80 }}>
        <div className="card-accent" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Quote Summary</p>

          {!quote ? (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>◈</div>
              <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
                Fill in the form and hit<br /><em>Calculate Quote</em> to see pricing.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

              {/* Print specs */}
              <div style={{ marginBottom: 20, padding: "14px", background: "rgba(0,0,0,0.3)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <SpecRow label="Est. volume" value={`${quote.estimatedVolumeCm3} cm³`} mono />
                <SpecRow label="Est. weight" value={`${quote.estimatedWeightGrams} g`} mono />
                <SpecRow label="Est. print time" value={`${quote.estimatedPrintTimeMinutes} min`} mono />
              </div>

              {/* Cost breakdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                <SummaryRow label="Material cost" value={formatAud(quote.materialCostCents)} />
                <SummaryRow label="Machine time" value={formatAud(quote.machineCostCents)} />
                <SummaryRow label="Setup fee" value={formatAud(quote.setupFeeCents)} />
                <hr className="divider" style={{ margin: "4px 0" }} />
                <SummaryRow label="Subtotal" value={formatAud(quote.subtotalCents)} />
                <SummaryRow label="GST (10%)" value={formatAud(quote.gstCents)} />
                <SummaryRow label="Shipping" value={quote.shippingCents === 0 ? "Free (pickup)" : formatAud(quote.shippingCents)} />
              </div>

              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "14px 0",
                borderTop: "1px solid rgba(0,212,255,0.2)",
                marginBottom: 20
              }}>
                <span className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>Total (AUD)</span>
                <span className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)" }}>
                  {formatAud(quote.totalCents)}
                </span>
              </div>

              <button
                onClick={startCheckout}
                disabled={loadingCheckout}
                className="btn-primary"
                style={{ width: "100%" }}
              >
                {loadingCheckout ? "Redirecting..." : "Proceed to Payment →"}
              </button>

              <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 12 }}>
                Secure checkout via Stripe · GST included
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: "var(--text-dim)", letterSpacing: "0.02em" }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11, color: "var(--red)" }}>{error}</span>}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text)" }}>{value}</span>
    </div>
  );
}

function SpecRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</span>
      <span className={mono ? "font-mono" : ""} style={{ fontSize: 12, color: "var(--accent)" }}>{value}</span>
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect } from "react";
import { formatAud } from "@/lib/utils";
import { extractVolumeMm3FromFile } from "@/lib/mesh-volume-client";
import AddressAutocomplete, { type ParsedAddress } from "@/components/forms/address-autocomplete";

const LAYER_OPTIONS = [
  { value: 0.1,  label: "0.10 mm — Fine" },
  { value: 0.15, label: "0.15 mm — High" },
  { value: 0.2,  label: "0.20 mm — Standard" },
  { value: 0.3,  label: "0.30 mm — Draft" },
];
const INFILL_OPTIONS = [10, 15, 20, 30, 40, 50, 75, 100];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

type Colour = { id: string; name: string; hex: string; available: boolean; materials: string[] | null };
type FileItem = {
  id: string; file: File;
  material: "PLA" | "PETG" | "ABS";
  colour: string; quantity: number;
  layerHeightMm: number; infillPercent: number;
  removeSupports: boolean;
  volumeMm3: number | null;
  volumeError: string | null;
};
type ItemResult = {
  filename: string; material: string; colour: string; quantity: number;
  removeSupports: boolean;
  solidVolumeCm3: number; printedVolumeCm3: number;
  estimatedWeightGrams: number; estimatedPrintTimeMinutes: number;
  materialCostCents: number; machineCostCents: number;
  setupFeeCents: number; supportRemovalCents: number; itemTotalCents: number;
};
type QuoteApiResponse = {
  orderId: string; checkoutToken: string; items: ItemResult[];
  subtotalCents: number; shippingCents: number; gstCents: number; totalCents: number;
  displayPrintTimeMinutes: number;
};

function makeId() { return Math.random().toString(36).slice(2); }

export default function QuoteForm() {
  const [colours, setColours] = useState<Colour[]>([]);
  const [items, setItems] = useState<FileItem[]>([]);

  // Phase 2 fields — only shown after quote is calculated
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [shippingMethod, setShippingMethod] = useState<"shipping" | "pickup">("shipping");
  const [address, setAddress] = useState<ParsedAddress | null>(null);
  const [addressError, setAddressError] = useState("");

  const [quote, setQuote] = useState<QuoteApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  useEffect(() => {
    fetch("/api/colours").then(r => r.json())
      .then((d: Colour[]) => setColours(d))
      .catch(() => {});
  }, []);

  const handleAddressSelect = useCallback((a: ParsedAddress) => {
    setAddress(a); setAddressError("");
  }, []);

  async function computeVolume(file: File): Promise<{ volumeMm3: number | null; volumeError: string | null }> {
    try {
      const vol = await extractVolumeMm3FromFile(file);
      if (!isFinite(vol) || vol <= 0) {
        return { volumeMm3: null, volumeError: "Could not calculate volume — ensure mesh is a valid closed solid." };
      }
      return { volumeMm3: vol, volumeError: null };
    } catch (err) {
      return { volumeMm3: null, volumeError: err instanceof Error ? err.message : "Failed to parse file." };
    }
  }

  async function addFiles(fl: FileList | null) {
    if (!fl) return;
    const def = colours.find(c => c.available && (c.materials === null || c.materials.includes("PLA")))?.name ?? "Black";
    const stlFiles = Array.from(fl).filter(f => f.name.toLowerCase().endsWith(".stl"));
    if (stlFiles.length === 0) { setError("Only .stl files are accepted."); return; }

    const toAdd: FileItem[] = [];
    for (const f of stlFiles) {
      if (f.size > MAX_FILE_SIZE) { setError(`"${f.name}" exceeds 50 MB limit.`); continue; }
      const { volumeMm3, volumeError } = await computeVolume(f);
      toAdd.push({
        id: makeId(), file: f, material: "PLA", colour: def, quantity: 1,
        layerHeightMm: 0.2, infillPercent: 20, removeSupports: false,
        volumeMm3, volumeError,
      });
    }
    if (toAdd.length) {
      setItems(p => [...p, ...toAdd]);
      setQuote(null); // Clear any existing quote when files change
    }
  }

  function removeItem(id: string) { setItems(p => p.filter(x => x.id !== id)); setQuote(null); }
  function updateItem(id: string, patch: Partial<FileItem>) {
    setItems(p => p.map(x => {
      if (x.id !== id) return x;
      const updated = { ...x, ...patch };
      // If material changed, check if current colour is still valid for it
      if (patch.material && patch.material !== x.material) {
        const colourStillValid = colours.some(c =>
          c.name === updated.colour && c.available &&
          (c.materials === null || c.materials.includes(patch.material!))
        );
        if (!colourStillValid) {
          const fallback = colours.find(c =>
            c.available && (c.materials === null || c.materials.includes(patch.material!))
          );
          updated.colour = fallback?.name ?? updated.colour;
        }
      }
      return updated;
    }));
    setQuote(null);
  }

  // ── Phase 1: Calculate quote (files + settings only, no contact info) ──
  async function handleGetQuote() {
    setError(null); setFieldErrors({}); setUploadProgress("");
    setQuote(null);

    if (items.length === 0) { setError("Upload at least one STL file."); return; }

    const badVolume = items.find(i => !i.volumeMm3);
    if (badVolume) {
      setError(`"${badVolume.file.name}": ${badVolume.volumeError || "volume calculation failed."}`);
      return;
    }

    try {
      setLoadingQuote(true);

      // Step 1: Get signed upload URLs
      setUploadProgress("Preparing upload...");
      const urlRes = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: items.map(i => ({ name: i.file.name, size: i.file.size })) }),
      });
      if (!urlRes.ok) {
        const errData = await urlRes.json().catch(() => null);
        throw new Error(errData?.error || `Upload preparation failed (${urlRes.status}).`);
      }
      const { batchId, uploads } = await urlRes.json() as {
        batchId: string;
        uploads: { originalFilename: string; storagePath: string; signedUrl: string; token: string }[];
      };

      // Step 2: Upload files
      for (let i = 0; i < items.length; i++) {
        setUploadProgress(`Uploading ${i + 1} of ${items.length}: ${items[i].file.name}...`);
        const uploadRes = await fetch(uploads[i].signedUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: items[i].file,
        });
        if (!uploadRes.ok) throw new Error(`Failed to upload "${items[i].file.name}" — please try again.`);
      }

      // Step 3: Submit quote
      setUploadProgress("Calculating quote...");
      const quoteRes = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Contact fields — use placeholder for quote phase, real values submitted at checkout
          customerName: "Quote Request",
          email: "quote@placeholder.local",
          shippingMethod,
          shippingAddressLine1: "",
          shippingCity: "",
          shippingState: "",
          shippingPostcode: "0000",
          shippingCountry: "AU",
          batchId,
          items: items.map((item, i) => ({
            originalFilename: item.file.name,
            storagePath: uploads[i].storagePath,
            material: item.material,
            colour: item.colour,
            quantity: item.quantity,
            layerHeightMm: item.layerHeightMm,
            infillPercent: item.infillPercent,
            removeSupports: item.removeSupports,
          })),
        }),
      });
      if (!quoteRes.ok) {
        const errData = await quoteRes.json().catch(() => null);
        throw new Error(errData?.error || `Quote failed (${quoteRes.status}).`);
      }
      const data: QuoteApiResponse = await quoteRes.json();
      setQuote(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quote.");
    } finally {
      setLoadingQuote(false);
      setUploadProgress("");
    }
  }

  // ── Phase 2: Proceed to checkout (requires contact info) ──
  async function startCheckout() {
    if (!quote) return;
    setFieldErrors({});

    // Validate contact fields
    const errs: Record<string, string> = {};
    if (!customerName.trim()) errs.customerName = "Required";
    if (!email.includes("@")) errs.email = "Valid email required";
    if (shippingMethod === "shipping" && !address) {
      setAddressError("Select a verified Australian address");
      errs.address = "Required";
    }
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    try {
      setLoadingCheckout(true);

      // Update the order with real contact details before checkout
      const updateRes = await fetch("/api/quote/update-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: quote.orderId,
          checkoutToken: quote.checkoutToken,
          customerName,
          email,
          shippingMethod,
          shippingAddressLine1: address?.line1 ?? "",
          shippingAddressLine2: address?.line2 ?? "",
          shippingCity: address?.city ?? "",
          shippingState: address?.state ?? "",
          shippingPostcode: address?.postcode ?? "",
        }),
      });
      if (!updateRes.ok) {
        const errData = await updateRes.json().catch(() => null);
        throw new Error(errData?.error || "Failed to save contact details.");
      }

      // Now proceed to Stripe
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: quote.orderId, checkoutToken: quote.checkoutToken }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Checkout failed (${res.status}).`);
      }
      const data = await res.json();
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally { setLoadingCheckout(false); }
  }

  const hasQuote = !!quote;

  return (
    <div className="quote-grid" style={{
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 360px)",
      gap: "clamp(16px, 3vw, 28px)",
      alignItems: "start"
    }}>
      <style>{`
        @media (max-width: 768px) {
          .quote-grid { grid-template-columns: 1fr !important; }
          .hidden-mobile { display: none !important; }
          .file-settings-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .file-settings-grid { grid-template-columns: 1fr !important; }
          .contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Left column ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Phase 1: File upload + settings ── */}
        <div className="card-lg" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <span className="eyebrow" style={{ marginBottom: 14 }}>Step 1 — Upload &amp; Configure</span>

            {/* Drop zone */}
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "clamp(20px, 4vw, 32px) 20px",
              border: "2px dashed var(--border-hi)", borderRadius: 10,
              cursor: "pointer", background: "var(--bg2)",
              transition: "border-color 0.15s, background 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--orange)"; e.currentTarget.style.background = "rgba(249,115,22,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-hi)"; e.currentTarget.style.background = "var(--bg2)"; }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 28, opacity: 0.5 }}>⬆</span> Click or drop STL files
              </span>
              <span style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>STL only · max 50 MB per file · multiple files OK</span>
              <input type="file" accept=".stl" multiple onChange={e => addFiles(e.target.files)} style={{ display: "none" }} />
            </label>
          </div>

          {/* File cards */}
          {items.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((item, idx) => (
                <div key={item.id} style={{ border: "1px solid var(--border-hi)", borderRadius: 10, background: "var(--bg2)", overflow: "hidden" }}>
                  {/* File header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span className="font-mono" style={{ fontSize: 10, color: "var(--orange)", flexShrink: 0 }}>#{idx + 1}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.file.name}</span>
                      <span className="font-mono" style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>{(item.file.size / 1024).toFixed(0)}KB</span>
                      {item.volumeMm3 ? (
                        <span className="font-mono" style={{ fontSize: 10, color: "var(--green)", flexShrink: 0 }}>{(item.volumeMm3 / 1000).toFixed(1)} cm³</span>
                      ) : item.volumeError ? (
                        <span className="font-mono" style={{ fontSize: 10, color: "var(--red)", flexShrink: 0 }}>⚠ parse error</span>
                      ) : null}
                    </div>
                    <button type="button" onClick={() => removeItem(item.id)}
                      style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1, flexShrink: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = "var(--red)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "var(--muted)")}
                    >×</button>
                  </div>

                  {item.volumeError && (
                    <div style={{ padding: "8px 14px", background: "rgba(255,90,90,0.08)", borderBottom: "1px solid rgba(255,90,90,0.15)", fontSize: 12, color: "var(--red)" }}>
                      ⚠ {item.volumeError}
                    </div>
                  )}

                  {/* Settings grid */}
                  <div className="file-settings-grid" style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 70px 70px", gap: 10 }}>
                    {[
                      { label: "Material", helpId: "material", content: (
                        <select value={item.material} onChange={e => updateItem(item.id, { material: e.target.value as "PLA"|"PETG"|"ABS" })} className="input-field" style={{ fontSize: 12 }}>
                          <option value="PLA">PLA</option><option value="PETG">PETG</option><option value="ABS">ABS</option>
                        </select>
                      )},
                      { label: "Colour", helpId: "colour", content: (
                        <select value={item.colour} onChange={e => updateItem(item.id, { colour: e.target.value })} className="input-field" style={{ fontSize: 12 }}>
                          {colours.map(c => {
                            const materialOk = c.materials === null || c.materials.includes(item.material);
                            const selectable = c.available && materialOk;
                            return (
                              <option key={c.id} value={c.name} disabled={!selectable}
                                style={{ color: selectable ? "inherit" : "#666" }}>
                                {c.name}{!selectable ? " (unavailable)" : ""}
                              </option>
                            );
                          })}
                          {colours.length === 0 && <option value="Black">Black</option>}
                        </select>
                      )},
                      { label: "Layer", helpId: "layer-height", content: (
                        <select value={item.layerHeightMm} onChange={e => updateItem(item.id, { layerHeightMm: parseFloat(e.target.value) })} className="input-field" style={{ fontSize: 12 }}>
                          {LAYER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      )},
                      { label: "Infill", helpId: "infill", content: (
                        <select value={item.infillPercent} onChange={e => updateItem(item.id, { infillPercent: parseInt(e.target.value) })} className="input-field" style={{ fontSize: 12 }}>
                          {INFILL_OPTIONS.map(v => <option key={v} value={v}>{v}%</option>)}
                        </select>
                      )},
                      { label: "Qty", helpId: "", content: (
                        <input type="number" min={1} max={100} value={item.quantity}
                          onChange={e => updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                          className="input-field" style={{ fontSize: 12 }} />
                      )},
                    ].map(({ label, helpId, content }) => (
                      <label key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 4 }}>
                          {label}
                          {helpId && (
                            <a href={`/guide#${helpId}`} target="_blank" rel="noopener noreferrer"
                              title={`What is ${label.toLowerCase()}?`}
                              style={{ color: "var(--muted)", fontSize: 11, lineHeight: 1, textDecoration: "none", opacity: 0.5, transition: "opacity 0.15s" }}
                              onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                              onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}
                            >?</a>
                          )}
                        </span>
                        {content}
                      </label>
                    ))}
                  </div>

                  {/* Support removal toggle */}
                  <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                        <input type="checkbox" checked={item.removeSupports}
                          onChange={e => updateItem(item.id, { removeSupports: e.target.checked })}
                          style={{ accentColor: "var(--orange)", width: 16, height: 16 }} />
                        <span style={{ color: "var(--text)" }}>Remove support material</span>
                      </label>
                      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, lineHeight: 1.5 }}>
                        {item.removeSupports
                          ? "We'll clean and remove all support structures before shipping. A 20% surcharge applies for support removal and cleanup on this item."
                          : "Supports left on — faster processing, lower cost. You remove them yourself."}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Shipping method */}
          {items.length > 0 && (
            <>
              <hr className="divider" />
              <div>
                <span className="eyebrow" style={{ marginBottom: 14 }}>Delivery Method</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <label style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px",
                    border: `1px solid ${shippingMethod === "shipping" ? "var(--orange)" : "var(--border)"}`,
                    borderRadius: 8, cursor: "pointer", background: shippingMethod === "shipping" ? "rgba(249,115,22,0.04)" : "var(--bg2)",
                    transition: "border-color 0.15s, background 0.15s"
                  }}>
                    <input type="radio" name="shippingMethod" value="shipping" checked={shippingMethod === "shipping"}
                      onChange={() => { setShippingMethod("shipping"); setQuote(null); }}
                      style={{ accentColor: "var(--orange)", marginTop: 2 }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Ship to address — Australia Post</p>
                      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Flat rate $15.00 AUD — delivered to your door</p>
                    </div>
                  </label>
                  <label style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px",
                    border: `1px solid ${shippingMethod === "pickup" ? "var(--orange)" : "var(--border)"}`,
                    borderRadius: 8, cursor: "pointer", background: shippingMethod === "pickup" ? "rgba(249,115,22,0.04)" : "var(--bg2)",
                    transition: "border-color 0.15s, background 0.15s"
                  }}>
                    <input type="radio" name="shippingMethod" value="pickup" checked={shippingMethod === "pickup"}
                      onChange={() => { setShippingMethod("pickup"); setQuote(null); }}
                      style={{ accentColor: "var(--orange)", marginTop: 2 }} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Parcel locker pickup — Australia Post</p>
                      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Flat rate $2.50 AUD — dropped to parcel locker at Stirling Central Shopping Centre, 478 Wanneroo Rd, Westminster WA 6061</p>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}

          {error && <div className="error-box">{error}</div>}

          {uploadProgress && (
            <div style={{ fontSize: 13, color: "var(--orange)", display: "flex", alignItems: "center", gap: 8 }}>
              <span className="glow-pulse" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--orange)" }} />
              {uploadProgress}
            </div>
          )}

          {!hasQuote && (
            <button type="button" onClick={handleGetQuote} disabled={loadingQuote || items.length === 0} className="btn-primary" style={{ width: "100%", fontSize: 16 }}>
              {loadingQuote ? "Processing..." : items.length > 1 ? `Calculate Quote (${items.length} files) →` : "Calculate Quote →"}
            </button>
          )}
        </div>

        {/* ── Phase 2: Contact + address (only shown after quote) ── */}
        {hasQuote && (
          <div className="card-lg" style={{ display: "flex", flexDirection: "column", gap: 24, border: "1px solid var(--orange)", borderColor: "rgba(249,115,22,0.3)" }}>
            <span className="eyebrow" style={{ marginBottom: 0 }}>Step 2 — Your Details</span>

            <div className="contact-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Full name</span>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                  className="input-field" placeholder="Jane Smith" />
                {fieldErrors.customerName && <span style={{ fontSize: 11, color: "var(--red)" }}>{fieldErrors.customerName}</span>}
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Email</span>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input-field" placeholder="jane@example.com" />
                {fieldErrors.email && <span style={{ fontSize: 11, color: "var(--red)" }}>{fieldErrors.email}</span>}
              </label>
            </div>

            {shippingMethod === "shipping" && (
              <>
                <hr className="divider" />
                <div>
                  <span className="eyebrow" style={{ marginBottom: 14 }}>Shipping Address</span>
                  <AddressAutocomplete onSelect={handleAddressSelect} error={addressError} />
                  {address && (
                    <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, fontSize: 13, lineHeight: 1.6 }}>
                      <p>{address.line1}{address.line2 ? `, ${address.line2}` : ""}</p>
                      <p style={{ color: "var(--text-dim)" }}>{address.city} {address.state} {address.postcode}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {shippingMethod === "pickup" && (
              <div style={{ padding: "10px 14px", background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
                📍 Parcel locker pickup — Stirling Central Shopping Centre, 478 Wanneroo Rd, Westminster WA 6061. We&apos;ll email you when your order is ready for collection.
              </div>
            )}

            {error && <div className="error-box">{error}</div>}

            <button type="button" onClick={startCheckout} disabled={loadingCheckout || loadingQuote} className="btn-primary" style={{ width: "100%", fontSize: 16 }}>
              {loadingCheckout ? "Redirecting to payment..." : "Proceed to Payment →"}
            </button>
          </div>
        )}
      </div>

      {/* ── Summary sidebar ── */}
      <div style={{ position: "sticky", top: 76 }}>
        <div className="card-orange">
          <span className="eyebrow" style={{ marginBottom: 18 }}>Quote Summary</span>

          {!hasQuote ? (
            <div style={{ padding: "clamp(24px,4vw,40px) 0", textAlign: "center" }}>
              <div style={{ perspective: 300, display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <div style={{ width: 60, height: 60, position: "relative", transformStyle: "preserve-3d", animation: "rotateCube 6s linear infinite" }}>
                  {["translateZ(30px)","rotateY(180deg) translateZ(30px)","rotateY(-90deg) translateZ(30px)","rotateY(90deg) translateZ(30px)","rotateX(90deg) translateZ(30px)","rotateX(-90deg) translateZ(30px)"].map((t, i) => (
                    <div key={i} style={{ position: "absolute", width: 60, height: 60, border: "1px solid rgba(249,115,22,0.5)", background: "rgba(249,115,22,0.04)", transform: t }} />
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
                Upload files &amp; hit<br /><em>Calculate Quote</em>
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {quote.items.map((item, i) => (
                <div key={i} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>{item.filename}</p>
                      <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {item.material} · {item.colour} · qty {item.quantity}
                        {item.removeSupports ? " · supports removed" : ""}
                      </p>
                    </div>
                    <span className="font-mono" style={{ fontSize: 14, color: "var(--orange)", flexShrink: 0, marginLeft: 12 }}>{formatAud(item.itemTotalCents)}</span>
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 6, background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Estimated print time</span>
                <span className="font-mono" style={{ fontSize: 13, color: "var(--orange)" }}>{formatPrintTime(quote.displayPrintTimeMinutes)}</span>
              </div>

              <hr className="divider" />

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Row label={shippingMethod === "pickup" ? "Parcel locker pickup" : "Shipping (Australia Post)"} value={formatAud(quote.shippingCents)} />
                <Row label="GST (10%)" value={formatAud(quote.gstCents)} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid rgba(249,115,22,0.2)" }}>
                <span className="font-display" style={{ fontSize: 18 }}>TOTAL AUD</span>
                <span className="font-display" style={{ fontSize: 28, color: "var(--orange)" }}>{formatAud(quote.totalCents)}</span>
              </div>

              <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
                {hasQuote && !customerName ? "Fill in your details below to proceed ↓" : "Secure checkout via Stripe · GST included"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{label}</span>
      <span style={{ fontSize: 13 }}>{value}</span>
    </div>
  );
}

function formatPrintTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}


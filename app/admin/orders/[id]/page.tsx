import { createAdminClient } from "@/lib/supabase/admin";
import { formatAud } from "@/lib/utils";
import { notFound } from "next/navigation";
import Link from "next/link";
import OrderStatusActions from "@/components/admin/order-status-actions";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status.replace("_", " ")}</span>;
}

export default async function AdminOrderDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: order }, { data: files }, { data: quoteItems }, { data: history }] =
    await Promise.all([
      supabase.from("orders").select("*").eq("id", id).single(),
      supabase.from("order_files").select("*").eq("order_id", id).order("created_at"),
      supabase.from("quote_inputs").select("*").eq("order_id", id).order("original_filename"),
      supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at", { ascending: false })
    ]);

  if (!order) notFound();

  const shortId = (order.order_number
    ? `S3D-${String(order.order_number).padStart(4, "0")}`
    : `#${order.id.slice(0, 8).toUpperCase()}`
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <Link href="/admin/orders" style={{ fontSize: 12, color: "var(--text-dim)", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
            ← Back to orders
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700 }}>
              Order <span style={{ color: "var(--accent)" }}>{shortId}</span>
            </h1>
            <StatusBadge status={order.status} />
          </div>
          <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>
            {new Date(order.created_at).toLocaleString("en-AU", { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Actions */}
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Actions</p>
          <OrderStatusActions orderId={order.id} currentStatus={order.status} />
        </div>

        {/* Customer */}
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Customer</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <DetailRow label="Name" value={order.customer_name} />
            <DetailRow label="Email" value={order.email} />
            <hr className="divider" />

            {/* Delivery method indicator */}
            {/* #10: Use explicit delivery_method field, fall back to shipping_cents for legacy orders */}
            {(order.delivery_method === "pickup" || (!order.delivery_method && order.shipping_cents === 500)) ? (
              <>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                  background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)",
                  borderRadius: 8
                }}>
                  <span style={{ fontSize: 16 }}>📍</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--orange)" }}>PARCEL LOCKER PICKUP</p>
                    <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                      Stirling Central Shopping Centre, 478 Wanneroo Rd, Westminster WA 6061
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                  background: "rgba(0,229,160,0.06)", border: "1px solid rgba(0,229,160,0.2)",
                  borderRadius: 8
                }}>
                  <span style={{ fontSize: 16 }}>📦</span>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--green)" }}>SHIPPING — AUSTRALIA POST</p>
                </div>
                {order.shipping_address_line1 ? (
                  <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.7 }}>
                    <p>{order.shipping_address_line1}{order.shipping_address_line2 ? `, ${order.shipping_address_line2}` : ""}</p>
                    <p>{order.shipping_city} {order.shipping_state} {order.shipping_postcode}</p>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>No address recorded</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Pricing */}
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Pricing</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <DetailRow label="Subtotal" value={formatAud(order.subtotal_cents)} />
            <DetailRow label="GST (10%)" value={formatAud(order.gst_cents)} />
            <DetailRow label="Shipping" value={order.shipping_cents === 500 ? "Pickup ($5.00)" : formatAud(order.shipping_cents)} />
            <hr className="divider" />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="font-display" style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
              <span className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>{formatAud(order.total_cents)}</span>
            </div>
          </div>
        </div>

        {/* Status history */}
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Status History</p>
          {history?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {history.map((h) => (
                <div key={h.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", marginTop: 4, flexShrink: 0 }} />
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <StatusBadge status={h.status} />
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        {new Date(h.created_at).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    {h.note && <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>{h.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-dim)" }}>No history yet.</p>
          )}
        </div>
      </div>

      {/* ── Print items (full width — one card per file) ── */}
      <div>
        <p className="eyebrow" style={{ marginBottom: 16 }}>
          Print Items — {quoteItems?.length ?? 0} file{(quoteItems?.length ?? 0) !== 1 ? "s" : ""}
        </p>

        {quoteItems?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {quoteItems.map((qi, idx) => {
              // Find matching file record
              const matchedFile = files?.find(f =>
                f.id === qi.file_id || f.original_filename === qi.original_filename
              );

              return (
                <div key={qi.id} style={{
                  border: "1px solid var(--border-hi)",
                  borderRadius: 10,
                  background: "var(--surface)",
                  overflow: "hidden"
                }}>
                  {/* File header */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--bg2)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span className="font-mono" style={{ fontSize: 11, color: "var(--orange)", flexShrink: 0 }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {qi.original_filename || matchedFile?.original_filename || "Unknown file"}
                      </span>
                      {matchedFile && (
                        <span className="font-mono" style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>
                          {(matchedFile.file_size_bytes / 1024).toFixed(0)} KB
                        </span>
                      )}
                    </div>
                    {qi.line_total_cents != null && (
                      <span className="font-mono" style={{ fontSize: 14, color: "var(--orange)", flexShrink: 0 }}>
                        {formatAud(qi.line_total_cents)}
                      </span>
                    )}
                  </div>

                  {/* Specs grid */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                    gap: 16,
                    padding: "14px 16px"
                  }}>
                    <SpecCell label="Material" value={qi.material || "—"} />
                    <SpecCell label="Colour" value={qi.colour || "—"} />
                    <SpecCell label="Layer height" value={qi.layer_height_mm ? `${qi.layer_height_mm} mm` : "—"} />
                    <SpecCell label="Infill" value={qi.infill_percent != null ? `${qi.infill_percent}%` : "—"} />
                    <SpecCell label="Quantity" value={String(qi.quantity ?? "—")} />
                    <SpecCell label="Est. volume" value={qi.estimated_volume_cm3 ? `${qi.estimated_volume_cm3} cm³` : "—"} />
                    <SpecCell label="Est. print time" value={qi.estimated_print_time_minutes ? `${qi.estimated_print_time_minutes} min` : "—"} />
                  </div>

                  {/* Storage path + download */}
                  {matchedFile && (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "6px 16px 10px", borderTop: "1px solid var(--border)", gap: 12
                    }}>
                      <span className="font-mono" style={{ fontSize: 10, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {matchedFile.storage_path}
                      </span>
                      <a
                        href={`/api/admin/orders/${order.id}/files/${matchedFile.id}/download`}
                        download
                        style={{
                          flexShrink: 0, fontSize: 11, fontWeight: 600,
                          color: "var(--accent)", textDecoration: "none",
                          padding: "3px 10px", border: "1px solid var(--accent)",
                          borderRadius: 4, lineHeight: 1.6
                        }}
                      >
                        Download STL
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card">
            <p style={{ fontSize: 13, color: "var(--text-dim)" }}>No print specifications recorded.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
      <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13, color: "var(--text)" }}>{value}</p>
    </div>
  );
}

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

  const [{ data: order }, { data: files }, { data: quote }, { data: history }] =
    await Promise.all([
      supabase.from("orders").select("*").eq("id", id).single(),
      supabase.from("order_files").select("*").eq("order_id", id),
      supabase.from("quote_inputs").select("*").eq("order_id", id).single(),
      supabase.from("order_status_history").select("*").eq("order_id", id).order("created_at", { ascending: false })
    ]);

  if (!order) notFound();

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
              Order <span style={{ color: "var(--accent)" }}>#{order.id.slice(0, 8).toUpperCase()}</span>
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
          <OrderStatusActions orderId={order.id} />
        </div>

        {/* Customer */}
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Customer</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <DetailRow label="Name" value={order.customer_name} />
            <DetailRow label="Email" value={order.email} />
            <DetailRow label="Phone" value={order.phone || "—"} />
          </div>
        </div>

        {/* Pricing */}
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Pricing</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <DetailRow label="Subtotal" value={formatAud(order.subtotal_cents)} />
            <DetailRow label="GST (10%)" value={formatAud(order.gst_cents)} />
            <DetailRow label="Shipping" value={order.shipping_cents === 0 ? "Free (pickup)" : formatAud(order.shipping_cents)} />
            <hr className="divider" />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="font-display" style={{ fontSize: 14, fontWeight: 600 }}>Total</span>
              <span className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>{formatAud(order.total_cents)}</span>
            </div>
          </div>
        </div>

        {/* Quote inputs */}
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Print Specifications</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <DetailRow label="Material" value={quote?.material || "—"} />
            <DetailRow label="Colour" value={quote?.colour || "—"} />
            <DetailRow label="Layer height" value={quote?.layer_height_mm ? `${quote.layer_height_mm} mm` : "—"} />
            <DetailRow label="Infill" value={quote?.infill_percent != null ? `${quote.infill_percent}%` : "—"} />
            <DetailRow label="Quantity" value={String(quote?.quantity ?? "—")} />
            <DetailRow label="Est. volume" value={quote?.estimated_volume_cm3 ? `${quote.estimated_volume_cm3} cm³` : "—"} />
            <DetailRow label="Est. print time" value={quote?.estimated_print_time_minutes ? `${quote.estimated_print_time_minutes} min` : "—"} />
            <DetailRow label="Shipping method" value={quote?.shipping_method || "—"} />
          </div>
        </div>

        {/* Files */}
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 16 }}>Files</p>
          {files?.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {files.map((f) => (
                <div key={f.id} style={{
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "12px 14px"
                }}>
                  <p className="font-mono" style={{ fontSize: 12, color: "var(--text)" }}>{f.original_filename}</p>
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    {(f.file_size_bytes / 1024).toFixed(1)} KB · {f.storage_path}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-dim)" }}>No files attached.</p>
          )}
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

import { createAdminClient } from "@/lib/supabase/admin";
import { formatAud } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge badge-${status}`}>{status.replace("_", " ")}</span>
  );
}

export default async function AdminOrdersPage() {
  const supabase = createAdminClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return <div className="error-box">Failed to load orders: {error.message}</div>;
  }

  const counts = {
    total: orders?.length ?? 0,
    paid: orders?.filter(o => o.status === "paid").length ?? 0,
    printing: orders?.filter(o => o.status === "printing").length ?? 0,
    completed: orders?.filter(o => o.status === "completed").length ?? 0,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Dashboard</p>
          <h1 className="font-display" style={{ fontSize: 32, fontWeight: 700 }}>Orders</h1>
        </div>
        <form action="/api/admin/logout" method="POST">
          <button type="submit" className="btn-ghost" style={{ fontSize: 12 }}>Log out</button>
        </form>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          { label: "Total Orders", value: counts.total, color: "var(--text)" },
          { label: "Awaiting Print", value: counts.paid, color: "var(--accent)" },
          { label: "Printing", value: counts.printing, color: "var(--amber)" },
          { label: "Completed", value: counts.completed, color: "var(--green)" },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: "center" }}>
            <p className="font-display" style={{ fontSize: 32, fontWeight: 700, color: s.color }}>{s.value}</p>
            <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "100px 1fr 1fr 120px 120px 160px 80px",
          gap: 12,
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg2)"
        }}>
          {["ID", "Customer", "Email", "Status", "Total", "Date", ""].map(h => (
            <span key={h} className="font-mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</span>
          ))}
        </div>

        <div>
          {orders?.map((order) => (
            <div key={order.id} style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr 1fr 120px 120px 160px 80px",
              gap: 12,
              padding: "14px 20px",
              borderBottom: "1px solid var(--border)",
              alignItems: "center",
              transition: "background 0.1s"
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span className="font-mono" style={{ fontSize: 12, color: "var(--accent)" }}>#{order.id.slice(0, 8).toUpperCase()}</span>
              <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.customer_name}</span>
              <span style={{ fontSize: 12, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.email}</span>
              <StatusBadge status={order.status} />
              <span className="font-mono" style={{ fontSize: 13 }}>{formatAud(order.total_cents)}</span>
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{new Date(order.created_at).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" })}</span>
              <Link href={`/admin/orders/${order.id}`} style={{
                fontSize: 12,
                color: "var(--accent)",
                border: "1px solid var(--accent-dim)",
                borderRadius: 6,
                padding: "4px 10px",
                display: "inline-block",
                transition: "background 0.15s"
              }}>
                View →
              </Link>
            </div>
          ))}

          {!orders?.length && (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
              No orders yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

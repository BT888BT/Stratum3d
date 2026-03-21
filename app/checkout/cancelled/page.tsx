import Link from "next/link";

export default function CheckoutCancelledPage() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card" style={{ maxWidth: 480, width: "100%", textAlign: "center", padding: 48, borderColor: "var(--border-hi)" }}>
        <div style={{ fontSize: 48, marginBottom: 20, opacity: 0.4 }}>✕</div>
        <p className="eyebrow" style={{ marginBottom: 12, color: "var(--red)" }}>Payment Cancelled</p>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Order Not Completed</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
          Your payment was cancelled. Your quote draft is still saved — you can start a new quote and try again.
        </p>
        <Link href="/quote" className="btn-primary">Return to Quote →</Link>
      </div>
    </div>
  );
}

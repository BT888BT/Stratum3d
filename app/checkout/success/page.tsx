import Link from "next/link";

export default function CheckoutSuccessPage() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="card-accent corner-accent" style={{ maxWidth: 480, width: "100%", textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 20 }}>✓</div>
        <p className="eyebrow" style={{ marginBottom: 12 }}>Order Confirmed</p>
        <h1 className="font-display" style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Payment Successful</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.7, marginBottom: 32 }}>
          Your order has been received and payment confirmed. You'll get an email update as your print progresses through production.
        </p>
        <Link href="/" className="btn-primary">Back to Home →</Link>
      </div>
    </div>
  );
}

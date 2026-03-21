import QuoteForm from "@/components/forms/quote-form";

export default function QuotePage() {
  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <p className="eyebrow" style={{ marginBottom: 10 }}>Instant Pricing</p>
        <h1 className="font-display" style={{ fontSize: 36, fontWeight: 700, marginBottom: 10 }}>
          Get a Quote
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: 15 }}>
          Upload your model and configure your print — pricing is calculated instantly.
        </p>
      </div>
      <QuoteForm />
    </div>
  );
}

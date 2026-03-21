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
  estimatedVolumeCm3: number;
  estimatedPrintTimeMinutes: number;
};

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
    shippingMethod: "pickup"
  }
});

  async function onSubmit(values: QuoteInput) {
    setError(null);
    setQuote(null);

    if (!file) {
      setError("Please upload a file.");
      return;
    }

    try {
      setLoadingQuote(true);

      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
      formData.append("file", file);

      const res = await fetch("/api/quote", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create quote.");
      }

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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orderId: quote.orderId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create checkout session.");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start checkout."
      );
    } finally {
      setLoadingCheckout(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 rounded-3xl border border-neutral-800 bg-neutral-900 p-6"
      >
        <div>
          <h2 className="text-2xl font-semibold">Get a quote</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Upload your model and enter the print details.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" error={errors.customerName?.message}>
            <input
              {...register("customerName")}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3"
            />
          </Field>

          <Field label="Email" error={errors.email?.message}>
            <input
              {...register("email")}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3"
            />
          </Field>

          <Field label="Phone" error={errors.phone?.message}>
            <input
              {...register("phone")}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3"
            />
          </Field>

          <Field label="Material" error={errors.material?.message}>
            <select
              {...register("material")}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3"
            >
              <option value="PLA">PLA</option>
              <option value="PETG">PETG</option>
              <option value="ABS">ABS</option>
            </select>
          </Field>

          <Field label="Colour" error={errors.colour?.message}>
            <input
              {...register("colour")}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3"
            />
          </Field>

          <Field label="Quantity" error={errors.quantity?.message}>
            <input
              type="number"
              {...register("quantity")}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3"
            />
          </Field>

          <Field label="Layer height (mm)" error={errors.layerHeightMm?.message}>
            <input
              type="number"
              step="0.01"
              {...register("layerHeightMm")}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3"
            />
          </Field>

          <Field label="Infill (%)" error={errors.infillPercent?.message}>
            <input
              type="number"
              {...register("infillPercent")}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3"
            />
          </Field>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Approx size (mm)</p>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="X" error={errors.approxXmm?.message}>
              <input
                type="number"
                {...register("approxXmm")}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3"
              />
            </Field>
            <Field label="Y" error={errors.approxYmm?.message}>
              <input
                type="number"
                {...register("approxYmm")}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3"
              />
            </Field>
            <Field label="Z" error={errors.approxZmm?.message}>
              <input
                type="number"
                {...register("approxZmm")}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3"
              />
            </Field>
          </div>
        </div>

        <Field label="Shipping" error={errors.shippingMethod?.message}>
          <select
            {...register("shippingMethod")}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3"
          >
            <option value="pickup">Pickup</option>
            <option value="standard">Standard shipping</option>
          </select>
        </Field>

        <div className="space-y-2">
          <label className="text-sm text-neutral-300">File upload</label>
          <input
            type="file"
            accept=".stl,.obj,.3mf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm"
          />
          <p className="text-xs text-neutral-500">
            Accepted: STL, OBJ, 3MF. Max 50 MB.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loadingQuote}
          className="rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingQuote ? "Calculating..." : "Create quote"}
        </button>
      </form>

      <aside className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
        <h3 className="text-xl font-semibold">Quote summary</h3>

        {!quote ? (
          <p className="mt-4 text-sm text-neutral-400">
            Your quote will appear here after submission.
          </p>
        ) : (
          <div className="mt-6 space-y-4">
            <SummaryRow
              label="Estimated volume"
              value={`${quote.estimatedVolumeCm3} cm³`}
            />
            <SummaryRow
              label="Estimated print time"
              value={`${quote.estimatedPrintTimeMinutes} min`}
            />
            <SummaryRow
              label="Subtotal"
              value={formatAud(quote.subtotalCents)}
            />
            <SummaryRow
              label="GST"
              value={formatAud(quote.gstCents)}
            />
            <SummaryRow
              label="Shipping"
              value={formatAud(quote.shippingCents)}
            />
            <div className="border-t border-neutral-800 pt-4">
              <SummaryRow
                label="Total"
                value={formatAud(quote.totalCents)}
                bold
              />
            </div>

            <button
              onClick={startCheckout}
              disabled={loadingCheckout}
              className="mt-4 w-full rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingCheckout ? "Redirecting..." : "Proceed to payment"}
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm text-neutral-300">{label}</span>
      {children}
      {error ? <span className="text-xs text-red-300">{error}</span> : null}
    </label>
  );
}

function SummaryRow({
  label,
  value,
  bold = false
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-neutral-400">{label}</span>
      <span className={bold ? "font-semibold" : "text-neutral-100"}>
        {value}
      </span>
    </div>
  );
}

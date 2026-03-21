import Link from "next/link";

export default function CheckoutCancelledPage() {
  return (
    <section className="mx-auto max-w-2xl rounded-3xl border border-neutral-800 bg-neutral-900 p-8 text-center">
      <h1 className="text-3xl font-semibold">Payment cancelled</h1>
      <p className="mt-4 text-neutral-300">
        Your order draft still exists, but payment was not completed.
      </p>
      <Link
        href="/quote"
        className="mt-6 inline-block rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black"
      >
        Return to quote
      </Link>
    </section>
  );
}

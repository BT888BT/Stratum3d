import { createAdminClient } from "@/lib/supabase/admin";
import { formatAud } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const supabase = createAdminClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-red-200">
        Failed to load orders: {error.message}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">
          Admin
        </p>
        <h1 className="text-3xl font-semibold">Orders</h1>
      </div>

      <div className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900">
        <div className="grid grid-cols-6 gap-4 border-b border-neutral-800 px-6 py-4 text-sm text-neutral-400">
          <div>ID</div>
          <div>Customer</div>
          <div>Status</div>
          <div>Total</div>
          <div>Created</div>
          <div>Open</div>
        </div>

        <div className="divide-y divide-neutral-800">
          {orders?.map((order) => (
            <div
              key={order.id}
              className="grid grid-cols-6 gap-4 px-6 py-4 text-sm"
            >
              <div className="truncate">{order.id.slice(0, 8)}</div>
              <div className="truncate">{order.customer_name}</div>
              <div>
                <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs uppercase tracking-wide">
                  {order.status}
                </span>
              </div>
              <div>{formatAud(order.total_cents)}</div>
              <div>{new Date(order.created_at).toLocaleString("en-AU")}</div>
              <div>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="text-neutral-200 underline"
                >
                  View
                </Link>
              </div>
            </div>
          ))}

          {!orders?.length ? (
            <div className="px-6 py-8 text-sm text-neutral-400">
              No orders yet.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

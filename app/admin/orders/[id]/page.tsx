import { createAdminClient } from "@/lib/supabase/admin";
import { formatAud } from "@/lib/utils";
import { notFound } from "next/navigation";
import OrderStatusActions from "@/components/admin/order-status-actions";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: order }, { data: files }, { data: quote }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).single(),
    supabase.from("order_files").select("*").eq("order_id", id),
    supabase.from("quote_inputs").select("*").eq("order_id", id).single()
  ]);

  if (!order) notFound();

  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-neutral-400">
          Order
        </p>
        <h1 className="text-3xl font-semibold">{order.id}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Actions">
          <OrderStatusActions orderId={order.id} />
        </Card>

        <Card title="Customer">
          <div className="space-y-3">
            <Detail label="Name" value={order.customer_name} />
            <Detail label="Email" value={order.email} />
            <Detail label="Phone" value={order.phone || "-"} />
            <Detail label="Status" value={order.status} />
          </div>
        </Card>

        <Card title="Totals">
          <div className="space-y-3">
            <Detail label="Subtotal" value={formatAud(order.subtotal_cents)} />
            <Detail label="GST" value={formatAud(order.gst_cents)} />
            <Detail label="Shipping" value={formatAud(order.shipping_cents)} />
            <Detail label="Total" value={formatAud(order.total_cents)} />
          </div>
        </Card>

        <Card title="Quote inputs">
          <div className="space-y-3">
            <Detail label="Material" value={quote?.material || "-"} />
            <Detail label="Colour" value={quote?.colour || "-"} />
            <Detail
              label="Layer height"
              value={quote?.layer_height_mm ? `${quote.layer_height_mm} mm` : "-"}
            />
            <Detail
              label="Infill"
              value={
                typeof quote?.infill_percent === "number"
                  ? `${quote.infill_percent}%`
                  : "-"
              }
            />
            <Detail label="Quantity" value={String(quote?.quantity ?? "-")} />
            <Detail
              label="Estimated volume"
              value={
                quote?.estimated_volume_cm3
                  ? `${quote.estimated_volume_cm3} cm³`
                  : "-"
              }
            />
            <Detail
              label="Estimated print time"
              value={
                quote?.estimated_print_time_minutes
                  ? `${quote.estimated_print_time_minutes} min`
                  : "-"
              }
            />
          </div>
        </Card>

        <Card title="Files">
          {files?.length ? (
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-3"
                >
                  <p className="font-medium">{file.original_filename}</p>
                  <p className="mt-1 text-sm text-neutral-400">
                    {file.file_size_bytes} bytes
                  </p>
                  <p className="mt-1 text-sm text-neutral-400">
                    {file.storage_path}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">No files linked.</p>
          )}
        </Card>
      </div>
    </section>
  );
}

function Card({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-900 p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-neutral-400">{label}</span>
      <span>{value}</span>
    </div>
  );
}

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM ?? "orders@stratum3d.com";
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? "";
const ADMIN = process.env.EMAIL_ADMIN ?? "";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "";

function formatAud(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD"
  }).format(cents / 100);
}

/** Escape user-supplied strings before inserting into HTML emails */
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrderLineItem = {
  filename: string;
  material: string;
  colour: string;
  layerHeightMm: number;
  infillPercent: number;
  quantity: number;
  removeSupports: boolean;
  lineTotalCents: number;
};

// ─── Customer: order confirmation ────────────────────────────────────────────

export async function sendOrderConfirmationEmail(order: {
  id: string;
  orderNumber?: number;
  customerName: string;
  email: string;
  totalCents: number;
  subtotalCents: number;
  shippingCents: number;
  gstCents: number;
  items: OrderLineItem[];
  shippingAddress: string;
  shippingMethod: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set. Add it to your Vercel environment variables.");
  }

  const shortId = order.orderNumber
    ? `S3D-${String(order.orderNumber).padStart(4, "0")}`
    : order.id.slice(0, 8).toUpperCase();

  const adminLink = `${SITE}/admin/orders/${order.id}`;

  // Build invoice item rows
  const itemRowsHtml = order.items.map((item) => `
    <tr style="border-top:1px solid #eee">
      <td style="padding:10px 0;vertical-align:top">
        <p style="font-weight:600;font-size:14px;margin:0;color:#111">${esc(item.filename)}</p>
        <p style="font-size:12px;color:#777;margin:4px 0 0 0">
          ${esc(item.material)} · ${esc(item.colour)} · ${item.layerHeightMm}mm layer · ${item.infillPercent}% infill${item.removeSupports ? " · supports removed" : ""}
        </p>
      </td>
      <td style="padding:10px 0;text-align:center;vertical-align:top;font-size:14px;color:#555;width:50px">×${item.quantity}</td>
      <td style="padding:10px 0;text-align:right;vertical-align:top;font-size:14px;font-weight:600;color:#111;width:90px">${formatAud(item.lineTotalCents)}</td>
    </tr>
  `).join("");

  const deliveryLabel = order.shippingMethod === "pickup"
    ? "Parcel locker pickup"
    : "Shipping (Australia Post)";

  // Customer email
  const { data, error } = await resend.emails.send({
    from: FROM,
    replyTo: REPLY_TO || undefined,
    to: order.email,
    subject: `Stratum3D — Order ${shortId} confirmed`,
    html: `
      <div style="font-family:sans-serif;max-width:580px;margin:auto;color:#111">
        <h2 style="margin-bottom:4px">Thanks, ${esc(order.customerName)}!</h2>
        <p style="color:#555;margin-top:0">Your 3D print order has been placed and payment received.</p>

        <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:20px;margin:24px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:0 0 16px 0;font-size:13px;color:#555">Order</td>
              <td style="padding:0 0 16px 0;text-align:right;font-weight:700;font-size:15px" colspan="2">${shortId}</td>
            </tr>
            <tr style="border-top:2px solid #ddd">
              <td style="padding:12px 0 8px 0;font-weight:600;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.08em">Item</td>
              <td style="padding:12px 0 8px 0;font-weight:600;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.08em;text-align:center">Qty</td>
              <td style="padding:12px 0 8px 0;font-weight:600;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.08em;text-align:right">Price</td>
            </tr>
            ${itemRowsHtml}
            <tr style="border-top:2px solid #ddd">
              <td style="padding:12px 0 6px 0;color:#555;font-size:14px" colspan="2">Subtotal</td>
              <td style="padding:12px 0 6px 0;text-align:right;font-size:14px">${formatAud(order.subtotalCents)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#555;font-size:14px" colspan="2">${deliveryLabel}</td>
              <td style="padding:4px 0;text-align:right;font-size:14px">${formatAud(order.shippingCents)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#555;font-size:14px" colspan="2">GST (10%)</td>
              <td style="padding:4px 0;text-align:right;font-size:14px">${formatAud(order.gstCents)}</td>
            </tr>
            <tr style="border-top:2px solid #333">
              <td style="padding:12px 0;font-weight:700;font-size:16px" colspan="2">Total paid</td>
              <td style="padding:12px 0;text-align:right;font-weight:700;font-size:16px">${formatAud(order.totalCents)}</td>
            </tr>
          </table>
        </div>

        ${order.shippingMethod === "pickup"
          ? `<p style="font-size:14px;color:#555">📍 <strong>Pickup:</strong> Stirling Central Shopping Centre, 478 Wanneroo Rd, Westminster WA 6061 — we'll email you when it's ready for collection.</p>`
          : `<p style="font-size:14px;color:#555">📦 <strong>Ship to:</strong> ${esc(order.shippingAddress)}</p>`
        }

        <p style="color:#555;font-size:14px;margin-top:20px">We'll send you another email when your print status changes. If you have any questions, just reply to this email.</p>
        <p style="color:#555;font-size:14px">— The Stratum3D team</p>
      </div>
    `
  });

  if (error) {
    console.error(`[email] Resend API error for ${order.email}:`, JSON.stringify(error));
    throw new Error(`Resend: ${error.message || JSON.stringify(error)}`);
  }

  console.log(`[email] Order confirmation sent to ${order.email} for ${shortId} (id: ${data?.id})`);

  // Admin notification (separate — don't fail customer email if this breaks)
  if (ADMIN) {
    const itemSummary = order.items.map(i => `${esc(i.filename)} (${esc(i.material)} ${esc(i.colour)} ×${i.quantity}${i.removeSupports ? " +supports removed" : ""})`).join(", ");
    const deliveryInfo = order.shippingMethod === "pickup" ? "📍 Parcel locker pickup" : `📦 Ship to: ${esc(order.shippingAddress)}`;
    const { error: adminErr } = await resend.emails.send({
      from: FROM,
      to: ADMIN,
      subject: `New paid order ${shortId} — ${order.customerName}`,
      html: `
        <div style="font-family:sans-serif;max-width:540px;margin:auto;color:#111">
          <h2>New order received</h2>
          <p><strong>Customer:</strong> ${esc(order.customerName)} (${esc(order.email)})</p>
          <p><strong>Total:</strong> ${formatAud(order.totalCents)}</p>
          <p><strong>Delivery:</strong> ${deliveryInfo}</p>
          <p><strong>Items:</strong> ${itemSummary}</p>
          <p><a href="${adminLink}" style="color:#0070f3">View order in admin →</a></p>
        </div>
      `
    });
    if (adminErr) {
      console.error("[email] Admin notification failed:", JSON.stringify(adminErr));
    }
  }
}

// ─── Customer: status update ──────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  printing: "Your order is now printing",
  completed: "Your order is complete",
  cancelled: "Your order has been cancelled",
  paid: "Payment confirmed"
};

export async function sendStatusUpdateEmail(order: {
  id: string;
  orderNumber?: number;
  customerName: string;
  email: string;
  status: string;
  note?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: false, reason: "RESEND_API_KEY is not set. Add it to your Vercel environment variables." };
  }

  const label = STATUS_LABELS[order.status];
  if (!label) {
    return { sent: false, reason: `No email template for status "${order.status}" — only printing/completed/cancelled/paid trigger emails.` };
  }

  const shortId = order.orderNumber
    ? `S3D-${String(order.orderNumber).padStart(4, "0")}`
    : order.id.slice(0, 8).toUpperCase();

  const { data, error } = await resend.emails.send({
    from: FROM,
    replyTo: REPLY_TO || undefined,
    to: order.email,
    subject: `Stratum3D — ${label} (${shortId})`,
    html: `
      <div style="font-family:sans-serif;max-width:540px;margin:auto;color:#111">
        <h2>${label}</h2>
        <p>Hi ${esc(order.customerName)},</p>
        <p>Your order <strong>${shortId}</strong> status has been updated to <strong>${esc(order.status)}</strong>.</p>
        ${order.note ? `<p style="background:#f5f5f5;padding:12px;border-radius:8px;color:#333">${esc(order.note)}</p>` : ""}
        <p style="color:#555;font-size:14px">If you have any questions, just reply to this email.</p>
        <p style="color:#555;font-size:14px">— The Stratum3D team</p>
      </div>
    `
  });

  if (error) {
    console.error(`[email] Resend API error for ${order.email}:`, JSON.stringify(error));
    return { sent: false, reason: `Resend: ${error.message || JSON.stringify(error)}` };
  }

  console.log(`[email] Status update "${order.status}" sent to ${order.email} for ${shortId} (id: ${data?.id})`);
  return { sent: true };
}

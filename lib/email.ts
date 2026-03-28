import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM ?? "orders@stratum3d.com";
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

// ─── Shared: check if email sending is configured ────────────────────────────

function isEmailConfigured(): boolean {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is not set — skipping email.");
    return false;
  }
  return true;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type OrderLineItem = {
  filename: string;
  material: string;
  colour: string;
  quantity: number;
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
}) {
  if (!isEmailConfigured()) return;

  const shortId = order.orderNumber
    ? `S3D-${String(order.orderNumber).padStart(4, "0")}`
    : order.id.slice(0, 8).toUpperCase();

  const adminLink = `${SITE}/admin/orders/${order.id}`;

  // Build item rows for the email
  const itemRowsHtml = order.items.map((item, i) => `
    <tr${i > 0 ? ' style="border-top:1px solid #eee"' : ""}>
      <td style="padding:8px 0;color:#555;font-size:14px">${esc(item.filename)}</td>
      <td style="padding:8px 0;text-align:right;font-size:14px">${esc(item.material)} · ${esc(item.colour)} × ${item.quantity}</td>
    </tr>
  `).join("");

  try {
    // Customer email
    await resend.emails.send({
      from: FROM,
      to: order.email,
      subject: `Stratum3D — Order ${shortId} confirmed`,
      html: `
        <div style="font-family:sans-serif;max-width:540px;margin:auto;color:#111">
          <h2 style="margin-bottom:4px">Thanks, ${esc(order.customerName)}!</h2>
          <p style="color:#555;margin-top:0">Your 3D print order has been placed and payment received.</p>

          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr><td style="padding:8px 0;color:#555">Order</td><td style="padding:8px 0;text-align:right"><strong>${shortId}</strong></td></tr>
            <tr style="border-top:1px solid #eee"><td colspan="2" style="padding:12px 0 6px;font-weight:600;font-size:13px;color:#333;text-transform:uppercase;letter-spacing:0.05em">Print items</td></tr>
            ${itemRowsHtml}
            <tr style="border-top:1px solid #eee"><td style="padding:8px 0;color:#555">Ship to</td><td style="padding:8px 0;text-align:right;font-size:14px">${esc(order.shippingAddress)}</td></tr>
            <tr style="border-top:1px solid #eee">
              <td style="padding:12px 0;color:#555">Subtotal</td><td style="padding:12px 0;text-align:right">${formatAud(order.subtotalCents)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#555">GST</td><td style="padding:8px 0;text-align:right">${formatAud(order.gstCents)}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#555">Shipping</td><td style="padding:8px 0;text-align:right">${formatAud(order.shippingCents)}</td>
            </tr>
            <tr style="border-top:1px solid #eee">
              <td style="padding:12px 0;font-weight:bold">Total</td><td style="padding:12px 0;text-align:right;font-weight:bold">${formatAud(order.totalCents)}</td>
            </tr>
          </table>

          <p style="color:#555;font-size:14px">We'll send you another email when your print status changes. If you have any questions, just reply to this email.</p>
          <p style="color:#555;font-size:14px">— The Stratum3D team</p>
        </div>
      `
    });
    console.log(`[email] Order confirmation sent to ${order.email} for ${shortId}`);
  } catch (err) {
    console.error(`[email] Failed to send order confirmation to ${order.email}:`, err);
    throw err;
  }

  // Admin notification (separate try — don't fail customer email if this breaks)
  if (ADMIN) {
    try {
      const itemSummary = order.items.map(i => `${esc(i.filename)} (${esc(i.material)} ${esc(i.colour)} ×${i.quantity})`).join(", ");
      await resend.emails.send({
        from: FROM,
        to: ADMIN,
        subject: `New paid order ${shortId} — ${order.customerName}`,
        html: `
          <div style="font-family:sans-serif;max-width:540px;margin:auto;color:#111">
            <h2>New order received</h2>
            <p><strong>Customer:</strong> ${esc(order.customerName)} (${esc(order.email)})</p>
            <p><strong>Total:</strong> ${formatAud(order.totalCents)}</p>
            <p><strong>Items:</strong> ${itemSummary}</p>
            <p><a href="${adminLink}" style="color:#0070f3">View order in admin →</a></p>
          </div>
        `
      });
    } catch (err) {
      console.error("[email] Admin notification failed:", err);
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
}) {
  if (!isEmailConfigured()) return;

  const label = STATUS_LABELS[order.status];
  if (!label) {
    console.log(`[email] No email template for status "${order.status}" — skipping.`);
    return;
  }

  const shortId = order.orderNumber
    ? `S3D-${String(order.orderNumber).padStart(4, "0")}`
    : order.id.slice(0, 8).toUpperCase();

  try {
    await resend.emails.send({
      from: FROM,
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
    console.log(`[email] Status update "${order.status}" sent to ${order.email} for ${shortId}`);
  } catch (err) {
    console.error(`[email] Failed to send status update to ${order.email}:`, err);
    throw err;
  }
}

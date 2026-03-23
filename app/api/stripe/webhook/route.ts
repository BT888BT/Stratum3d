import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderConfirmationEmail } from "@/lib/email";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return new Response(
      `Webhook Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      { status: 400 }
    );
  }

  try {
    const supabase = createAdminClient();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId =
        session.metadata?.orderId || session.client_reference_id || null;

      if (orderId) {
        await supabase
          .from("orders")
          .update({
            status: "paid",
            stripe_payment_intent_id:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : null
          })
          .eq("id", orderId);

        await supabase.from("order_status_history").insert({
          order_id: orderId,
          status: "paid",
          note: "Stripe payment completed"
        });

        // Fetch order + quote inputs to build the confirmation email
        const { data: order } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        const { data: quoteInput } = await supabase
          .from("quote_inputs")
          .select("*")
          .eq("order_id", orderId)
          .single();

        if (order) {
          await sendOrderConfirmationEmail({
            id: order.id,
            customerName: order.customer_name,
            email: order.email,
            totalCents: order.total_cents,
            subtotalCents: order.subtotal_cents,
            shippingCents: order.shipping_cents,
            gstCents: order.gst_cents,
            material: quoteInput?.material ?? "—",
            colour: quoteInput?.colour ?? "—",
            quantity: quoteInput?.quantity ?? 1,
            shippingAddress: [
              order.shipping_address_line1,
              order.shipping_address_line2,
              order.shipping_city && `${order.shipping_city} ${order.shipping_state} ${order.shipping_postcode}`
            ].filter(Boolean).join(", "),
            shippingAddress: [
              order.shipping_address_line1,
              order.shipping_address_line2,
              order.shipping_city,
              order.shipping_state,
              order.shipping_postcode,
            ].filter(Boolean).join(", "),
          }).catch((err) =>
            // Don't fail the webhook if email fails — log and continue
            console.error("[email] order confirmation failed:", err)
          );
        }
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    return new Response(
      `Webhook processing error: ${
        err instanceof Error ? err.message : "Unknown error"
      }`,
      { status: 500 }
    );
  }
}

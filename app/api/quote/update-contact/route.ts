import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orderId, checkoutToken, customerName, email, shippingMethod,
      shippingAddressLine1, shippingAddressLine2, shippingCity, shippingState, shippingPostcode } = body;

    if (!orderId || !checkoutToken) {
      return NextResponse.json({ error: "orderId and checkoutToken are required." }, { status: 400 });
    }
    if (!customerName || customerName.trim().length < 2) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }

    // Validate address for shipping orders
    if (shippingMethod === "shipping") {
      if (!shippingAddressLine1 || shippingAddressLine1.trim().length < 3) {
        return NextResponse.json({ error: "Shipping address is required." }, { status: 400 });
      }
      if (!shippingCity || !shippingState || !shippingPostcode) {
        return NextResponse.json({ error: "Complete shipping address is required." }, { status: 400 });
      }
      if (!/^\d{4}$/.test(shippingPostcode)) {
        return NextResponse.json({ error: "Must be a 4-digit Australian postcode." }, { status: 400 });
      }
    }

    const supabase = createAdminClient();

    // Verify order exists and token matches
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, status, checkout_token")
      .eq("id", orderId)
      .eq("checkout_token", checkoutToken)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found or invalid token." }, { status: 404 });
    }

    if (order.status !== "draft") {
      return NextResponse.json({ error: "Order has already been submitted." }, { status: 400 });
    }

    // Update the order with real contact details
    const updateData: Record<string, unknown> = {
      customer_name: customerName.trim(),
      email: email.trim().toLowerCase(),
    };

    if (shippingMethod === "shipping") {
      updateData.shipping_address_line1 = shippingAddressLine1;
      updateData.shipping_address_line2 = shippingAddressLine2 || null;
      updateData.shipping_city = shippingCity;
      updateData.shipping_state = shippingState;
      updateData.shipping_postcode = shippingPostcode;
      updateData.shipping_country = "AU";
    } else {
      // Pickup — clear any address fields
      updateData.shipping_address_line1 = null;
      updateData.shipping_address_line2 = null;
      updateData.shipping_city = null;
      updateData.shipping_state = null;
      updateData.shipping_postcode = null;
      updateData.shipping_country = "AU";
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[update-contact]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update contact details." },
      { status: 500 }
    );
  }
}

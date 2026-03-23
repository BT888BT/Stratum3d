import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateQuote } from "@/lib/quote";
import { extractVolumeMm3 } from "@/lib/mesh-volume";
import {
  isAllowedFile,
  maxFileSizeBytes,
  quoteInputSchema
} from "@/lib/validation";
import { slugFileName } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required." }, { status: 400 });
    }

    if (!isAllowedFile(file.name)) {
      return NextResponse.json(
        { error: "Invalid file type. Use STL, OBJ, or 3MF." },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > maxFileSizeBytes) {
      return NextResponse.json(
        { error: "File size is invalid or exceeds 50 MB." },
        { status: 400 }
      );
    }

    // Parse real mesh volume from the uploaded file
    let volumeMm3: number;
    try {
      volumeMm3 = await extractVolumeMm3(file);
      if (!isFinite(volumeMm3) || volumeMm3 <= 0) {
        return NextResponse.json(
          { error: "Could not calculate volume from your file. Please ensure it is a valid closed mesh." },
          { status: 422 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to parse your 3D file. Please ensure it is a valid STL, OBJ, or 3MF." },
        { status: 422 }
      );
    }

    const parsed = quoteInputSchema.safeParse({
      customerName: formData.get("customerName"),
      email: formData.get("email"),
      material: formData.get("material"),
      colour: formData.get("colour"),
      quantity: formData.get("quantity"),
      layerHeightMm: formData.get("layerHeightMm"),
      infillPercent: formData.get("infillPercent"),
      shippingAddressLine1: formData.get("shippingAddressLine1"),
      shippingAddressLine2: formData.get("shippingAddressLine2"),
      shippingCity: formData.get("shippingCity"),
      shippingState: formData.get("shippingState"),
      shippingPostcode: formData.get("shippingPostcode"),
      shippingCountry: formData.get("shippingCountry"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid form input.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Extract verified address fields
    const shippingAddressLine1 = formData.get("shippingAddressLine1") as string | null;
    const shippingAddressLine2 = formData.get("shippingAddressLine2") as string | null;
    const shippingCity = formData.get("shippingCity") as string | null;
    const shippingState = formData.get("shippingState") as string | null;
    const shippingPostcode = formData.get("shippingPostcode") as string | null;
    const shippingCountry = formData.get("shippingCountry") as string | null;

    if (!shippingAddressLine1 || !shippingCity || !shippingState || !shippingPostcode) {
      return NextResponse.json(
        { error: "A verified Australian shipping address is required." },
        { status: 400 }
      );
    }

    if (shippingCountry !== "AU") {
      return NextResponse.json(
        { error: "Shipping is only available within Australia." },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const quote = calculateQuote(input, volumeMm3);

    const supabase = createAdminClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: input.customerName,
        email: input.email,
        phone: null,
        status: "draft",
        currency: "AUD",
        subtotal_cents: quote.subtotalCents,
        shipping_cents: quote.shippingCents,
        gst_cents: quote.gstCents,
        total_cents: quote.totalCents,
        shipping_address_line1: shippingAddressLine1,
        shipping_address_line2: shippingAddressLine2 || null,
        shipping_city: shippingCity,
        shipping_state: shippingState,
        shipping_postcode: shippingPostcode,
        shipping_country: "AU",
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message || "Failed to create order.");
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "bin";
    const safeName = slugFileName(file.name);
    const storagePath = `${order.id}/${Date.now()}-${safeName}.${fileExt}`.replace(
      `.${fileExt}.${fileExt}`,
      `.${fileExt}`
    );

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("order-files")
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });

    if (uploadError) throw new Error(uploadError.message);

    await supabase.from("order_files").insert({
      order_id: order.id,
      original_filename: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      validation_status: "accepted"
    });

    await supabase.from("quote_inputs").insert({
      order_id: order.id,
      material: input.material,
      colour: input.colour,
      layer_height_mm: input.layerHeightMm,
      infill_percent: input.infillPercent,
      quantity: input.quantity,
      bounding_box_x_mm: null,
      bounding_box_y_mm: null,
      bounding_box_z_mm: null,
      estimated_volume_cm3: quote.estimatedVolumeCm3,
      estimated_print_time_minutes: quote.estimatedPrintTimeMinutes,
      shipping_method: "standard"
    });

    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: "draft",
      note: "Draft quote created"
    });

    return NextResponse.json({
      orderId: order.id,
      ...quote
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create quote." },
      { status: 500 }
    );
  }
}

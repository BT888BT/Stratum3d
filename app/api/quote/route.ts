import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateQuote } from "@/lib/quote";
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

    const parsed = quoteInputSchema.safeParse({
      customerName: formData.get("customerName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      material: formData.get("material"),
      colour: formData.get("colour"),
      quantity: formData.get("quantity"),
      layerHeightMm: formData.get("layerHeightMm"),
      infillPercent: formData.get("infillPercent"),
      approxXmm: formData.get("approxXmm"),
      approxYmm: formData.get("approxYmm"),
      approxZmm: formData.get("approxZmm"),
      shippingMethod: formData.get("shippingMethod")
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid form input.", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const quote = calculateQuote(input);

    const supabase = createAdminClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: input.customerName,
        email: input.email,
        phone: input.phone || null,
        status: "draft",
        currency: "AUD",
        subtotal_cents: quote.subtotalCents,
        shipping_cents: quote.shippingCents,
        gst_cents: quote.gstCents,
        total_cents: quote.totalCents
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

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { error: fileRecordError } = await supabase.from("order_files").insert({
      order_id: order.id,
      original_filename: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size_bytes: file.size,
      validation_status: "accepted"
    });

    if (fileRecordError) {
      throw new Error(fileRecordError.message);
    }

    const { error: quoteInputError } = await supabase.from("quote_inputs").insert({
      order_id: order.id,
      material: input.material,
      colour: input.colour,
      layer_height_mm: input.layerHeightMm,
      infill_percent: input.infillPercent,
      quantity: input.quantity,
      bounding_box_x_mm: input.approxXmm,
      bounding_box_y_mm: input.approxYmm,
      bounding_box_z_mm: input.approxZmm,
      estimated_volume_cm3: quote.estimatedVolumeCm3,
      estimated_print_time_minutes: quote.estimatedPrintTimeMinutes,
      shipping_method: input.shippingMethod
    });

    if (quoteInputError) {
      throw new Error(quoteInputError.message);
    }

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
      {
        error:
          error instanceof Error ? error.message : "Failed to create quote."
      },
      { status: 500 }
    );
  }
}

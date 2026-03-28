import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateItemQuote, sumQuote } from "@/lib/quote";
import { fileItemSchema, orderContactSchema } from "@/lib/validation";
import { slugFileName } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Rate limit: max 10 quote submissions per IP per 15 minutes
const quoteAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_QUOTES = 10;
const WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = quoteAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    quoteAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_QUOTES;
}

interface QuoteFileItem {
  originalFilename: string;
  storagePath: string;
  fileSizeBytes: number;
  volumeMm3: number;
  material: string;
  colour: string;
  quantity: number;
  layerHeightMm: number;
  infillPercent: number;
}

interface QuoteRequestBody {
  customerName: string;
  email: string;
  shippingAddressLine1: string;
  shippingAddressLine2?: string;
  shippingCity: string;
  shippingState: string;
  shippingPostcode: string;
  shippingCountry: string;
  batchId: string;
  items: QuoteFileItem[];
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many quote requests. Please wait a few minutes." },
        { status: 429 }
      );
    }

    let body: QuoteRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    // ── Contact/address ────────────────────────────────────
    const contactParsed = orderContactSchema.safeParse({
      customerName: body.customerName,
      email: body.email,
      shippingAddressLine1: body.shippingAddressLine1,
      shippingAddressLine2: body.shippingAddressLine2,
      shippingCity: body.shippingCity,
      shippingState: body.shippingState,
      shippingPostcode: body.shippingPostcode,
      shippingCountry: body.shippingCountry,
    });

    if (!contactParsed.success) {
      return NextResponse.json(
        { error: "Invalid contact/address details.", details: contactParsed.error.flatten() },
        { status: 400 }
      );
    }
    const contact = contactParsed.data;

    if (!body.items?.length) {
      return NextResponse.json({ error: "At least one file is required." }, { status: 400 });
    }

    // ── Validate + calculate each item ─────────────────────
    const validatedItems: { item: QuoteFileItem; settings: ReturnType<typeof fileItemSchema.parse> }[] = [];

    for (const item of body.items) {
      if (!item.volumeMm3 || !isFinite(item.volumeMm3) || item.volumeMm3 <= 0) {
        return NextResponse.json(
          { error: `"${item.originalFilename}": invalid volume. Ensure it is a valid closed mesh.` },
          { status: 422 }
        );
      }

      if (!item.storagePath) {
        return NextResponse.json(
          { error: `"${item.originalFilename}": missing storage path — upload may have failed.` },
          { status: 400 }
        );
      }

      const settingsParsed = fileItemSchema.safeParse({
        material: item.material,
        colour: item.colour,
        quantity: item.quantity,
        layerHeightMm: item.layerHeightMm,
        infillPercent: item.infillPercent,
      });

      if (!settingsParsed.success) {
        return NextResponse.json(
          { error: `"${item.originalFilename}": invalid settings.`, details: settingsParsed.error.flatten() },
          { status: 400 }
        );
      }

      validatedItems.push({ item, settings: settingsParsed.data });
    }

    // ── Calculate quote ────────────────────────────────────
    const itemQuotes = validatedItems.map(({ item, settings }) =>
      calculateItemQuote(settings, item.volumeMm3, item.originalFilename)
    );
    const quote = sumQuote(itemQuotes);

    // ── Save order ─────────────────────────────────────────
    const supabase = createAdminClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_name: contact.customerName,
        email: contact.email,
        phone: null,
        status: "draft",
        currency: "AUD",
        subtotal_cents: quote.subtotalCents,
        shipping_cents: quote.shippingCents,
        gst_cents: quote.gstCents,
        total_cents: quote.totalCents,
        shipping_address_line1: contact.shippingAddressLine1,
        shipping_address_line2: contact.shippingAddressLine2 || null,
        shipping_city: contact.shippingCity,
        shipping_state: contact.shippingState,
        shipping_postcode: contact.shippingPostcode,
        shipping_country: "AU",
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) throw new Error(orderError?.message || "Failed to create order.");

    // Build a human-readable folder name: S3D-0042_jane-smith
    const orderNum = String(order.order_number ?? "").padStart(4, "0");
    const customerSlug = slugFileName(contact.customerName).slice(0, 30);
    const folderName = `S3D-${orderNum}_${customerSlug}`;

    // ── Save files + quote inputs (linked) ─────────────────
    for (let i = 0; i < validatedItems.length; i++) {
      const { item, settings } = validatedItems[i];
      const itemQuote = itemQuotes[i];

      // Clean filename for storage: "benchy (1).stl" → "benchy-1-.stl"
      const safeName = slugFileName(item.originalFilename);
      const newPath = `${folderName}/${safeName}`;

      // Move file from pending upload location into the order folder
      const { error: moveError } = await supabase.storage
        .from("order-files")
        .move(item.storagePath, newPath);

      const finalPath = moveError ? item.storagePath : newPath;

      // Insert file record
      const { data: fileRecord } = await supabase
        .from("order_files")
        .insert({
          order_id: order.id,
          original_filename: item.originalFilename,
          storage_path: finalPath,
          mime_type: "model/stl",
          file_size_bytes: item.fileSizeBytes,
          validation_status: "accepted",
        })
        .select("id")
        .single();

      // Insert quote_inputs linked to the file
      await supabase.from("quote_inputs").insert({
        order_id: order.id,
        file_id: fileRecord?.id ?? null,
        original_filename: item.originalFilename,
        material: settings.material,
        colour: settings.colour,
        layer_height_mm: settings.layerHeightMm,
        infill_percent: settings.infillPercent,
        quantity: settings.quantity,
        bounding_box_x_mm: null,
        bounding_box_y_mm: null,
        bounding_box_z_mm: null,
        estimated_volume_cm3: itemQuote.solidVolumeCm3,
        estimated_print_time_minutes: itemQuote.estimatedPrintTimeMinutes,
        shipping_method: "standard",
        line_total_cents: itemQuote.itemTotalCents,
      });
    }

    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: "draft",
      note: `Draft quote — ${body.items.length} file(s): ${body.items.map(i => i.originalFilename).join(", ")}`,
    });

    return NextResponse.json({ orderId: order.id, ...quote });

  } catch (error) {
    console.error("[quote]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create quote." },
      { status: 500 }
    );
  }
}

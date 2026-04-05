import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateItemQuote, sumQuote } from "@/lib/quote";
import { extractMeshDataFromBuffer } from "@/lib/mesh-volume";
import { fileItemSchema, orderContactSchema } from "@/lib/validation";
import { slugFileName } from "@/lib/utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getTrustedIp, buildRateLimitKey } from "@/lib/trusted-ip";

export const dynamic = "force-dynamic";

interface QuoteFileItem {
  originalFilename: string;
  storagePath: string;
  material: string;
  colour: string;
  quantity: number;
  layerHeightMm: number;
  infillPercent: number;
  removeSupports: boolean;
}

interface QuoteRequestBody {
  customerName: string;
  email: string;
  shippingMethod: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostcode?: string;
  shippingCountry?: string;
  batchId: string;
  items: QuoteFileItem[];
}

export async function POST(request: Request) {
  try {
    const ip = getTrustedIp(request);
    const rateLimitKey = await buildRateLimitKey("quote", request);

    // Persistent rate limit
    const { allowed } = await checkRateLimit(rateLimitKey, 10, 15 * 60 * 1000);
    if (!allowed) {
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
      shippingMethod: body.shippingMethod || "shipping",
      shippingAddressLine1: body.shippingAddressLine1,
      shippingAddressLine2: body.shippingAddressLine2,
      shippingCity: body.shippingCity,
      shippingState: body.shippingState,
      shippingPostcode: body.shippingPostcode,
      shippingCountry: body.shippingCountry ?? "AU",
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
    if (body.items.length > 10) {
      return NextResponse.json({ error: "Maximum 10 files per order." }, { status: 400 });
    }

    const supabase = createAdminClient();

    // ── #2: Verify batch ownership and all paths belong to this batch ──
    const { data: pendingRows } = await supabase
      .from("pending_uploads")
      .select("*")
      .eq("batch_id", body.batchId)
      .eq("consumed", false)
      .gt("expires_at", new Date().toISOString());

    if (!pendingRows?.length) {
      return NextResponse.json(
        { error: "Upload batch not found or expired. Please re-upload your files." },
        { status: 400 }
      );
    }

    // #8: Verify the current requester is the original uploader
    const batchOwnerIp = pendingRows[0].ip_address;
    if (batchOwnerIp && batchOwnerIp !== ip) {
      console.warn(`[quote] Batch ownership mismatch: batch IP=${batchOwnerIp}, request IP=${ip}`);
      return NextResponse.json(
        { error: "Upload batch not found or expired. Please re-upload your files." },
        { status: 400 }
      );
    }

    const pendingByPath = new Map(pendingRows.map(r => [r.storage_path, r]));

    // Verify every submitted item has a matching pending upload
    for (const item of body.items) {
      if (!pendingByPath.has(item.storagePath)) {
        return NextResponse.json(
          { error: `"${item.originalFilename}": file not found in this upload batch.` },
          { status: 400 }
        );
      }
    }

    // ── Validate settings, download files, compute volume server-side ──
    type ValidatedItem = {
      item: QuoteFileItem;
      settings: ReturnType<typeof fileItemSchema.parse>;
      volumeMm3: number;
      heightMm: number;
      surfaceAreaMm2: number;
      actualSizeBytes: number;
    };
    const validatedItems: ValidatedItem[] = [];

    for (const item of body.items) {
      const settingsParsed = fileItemSchema.safeParse({
        material: item.material,
        colour: item.colour,
        quantity: item.quantity,
        layerHeightMm: item.layerHeightMm,
        infillPercent: item.infillPercent,
        removeSupports: item.removeSupports ?? false,
      });

      if (!settingsParsed.success) {
        return NextResponse.json(
          { error: `"${item.originalFilename}": invalid settings.`, details: settingsParsed.error.flatten() },
          { status: 400 }
        );
      }

      // #1 + #3: Download the actual file from Supabase Storage and verify it
      const { data: fileData, error: dlError } = await supabase.storage
        .from("order-files")
        .download(item.storagePath);

      if (dlError || !fileData) {
        return NextResponse.json(
          { error: `"${item.originalFilename}": file not found in storage. Upload may have failed.` },
          { status: 400 }
        );
      }

      const actualSizeBytes = fileData.size;

      // #3: Verify file isn't empty and isn't absurdly large
      if (actualSizeBytes < 84) {
        return NextResponse.json(
          { error: `"${item.originalFilename}": file is too small to be a valid STL.` },
          { status: 422 }
        );
      }
      if (actualSizeBytes > 50 * 1024 * 1024) {
        return NextResponse.json(
          { error: `"${item.originalFilename}": file exceeds 50 MB limit.` },
          { status: 400 }
        );
      }

      // #1: Recalculate volume + height SERVER-SIDE — ignore any client-supplied values
      let volumeMm3: number;
      let heightMm: number;
      let surfaceAreaMm2: number;
      try {
        const arrayBuf = await fileData.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const meshData = extractMeshDataFromBuffer(buffer, item.originalFilename);
        volumeMm3 = meshData.volumeMm3;
        heightMm = meshData.heightMm;
        surfaceAreaMm2 = meshData.surfaceAreaMm2;

        if (!isFinite(volumeMm3) || volumeMm3 <= 0) {
          return NextResponse.json(
            { error: `"${item.originalFilename}": could not calculate volume. Ensure it is a valid closed mesh.` },
            { status: 422 }
          );
        }
      } catch (err) {
        return NextResponse.json(
          { error: `"${item.originalFilename}": failed to parse — ${err instanceof Error ? err.message : "invalid STL"}` },
          { status: 422 }
        );
      }

      validatedItems.push({ item, settings: settingsParsed.data, volumeMm3, heightMm, surfaceAreaMm2, actualSizeBytes });
    }

    // ── Calculate quote from server-derived volumes ─────────
    const itemQuotes = validatedItems.map(({ item, settings, volumeMm3, heightMm, surfaceAreaMm2 }) =>
      calculateItemQuote(settings, volumeMm3, item.originalFilename, heightMm, surfaceAreaMm2)
    );
    const quote = sumQuote(itemQuotes, contact.shippingMethod ?? "shipping");

    // ── Debug: mesh stats + full cost breakdown per item ────
    for (let i = 0; i < validatedItems.length; i++) {
      const { item, settings, volumeMm3, heightMm, surfaceAreaMm2, actualSizeBytes } = validatedItems[i];
      const q = itemQuotes[i];
      const surfAreaCm2 = surfaceAreaMm2 / 100;
      const layerScale  = settings.layerHeightMm / 0.2;
      const layerCount  = heightMm > 0 ? Math.ceil(heightMm / settings.layerHeightMm) : 0;
      const matCostPerG = settings.material === "ABS" ? "$0.05" : "$0.04";
      const heightPct   = heightMm <= 50 ? "0" : heightMm <= 100 ? "5" : heightMm <= 200 ? "10" : "15";
      const saPct       = surfAreaCm2 <= 100 ? "0" : surfAreaCm2 <= 300 ? "5" : surfAreaCm2 <= 600 ? "10" : "15";
      console.log(`\n[quote:debug] ══ Item ${i + 1}: ${item.originalFilename} ══`);
      console.log(`[quote:debug]   ── Mesh data ──`);
      console.log(`[quote:debug]   File size            : ${(actualSizeBytes / 1024).toFixed(1)} KB`);
      console.log(`[quote:debug]   Solid volume         : ${q.solidVolumeCm3.toFixed(3)} cm³  (${volumeMm3.toFixed(1)} mm³)`);
      console.log(`[quote:debug]   Height (Z-extent)    : ${heightMm.toFixed(2)} mm  →  ${layerCount} layers @ ${settings.layerHeightMm} mm`);
      console.log(`[quote:debug]   Surface area         : ${surfAreaCm2.toFixed(2)} cm²  (${surfaceAreaMm2.toFixed(1)} mm²)`);
      console.log(`[quote:debug]   ── Settings ──`);
      console.log(`[quote:debug]   Material             : ${settings.material}  |  Colour: ${settings.colour}  |  Qty: ${settings.quantity}`);
      console.log(`[quote:debug]   Layer height         : ${settings.layerHeightMm} mm  |  Infill: ${settings.infillPercent}%  |  Support removal labour: ${settings.removeSupports}`);
      console.log(`[quote:debug]   ── Volume breakdown (per unit) ──`);
      console.log(`[quote:debug]   Shell volume         : ${q.shellVolumeCm3.toFixed(3)} cm³  (${surfaceAreaMm2.toFixed(0)} mm² × 0.8 mm shell / 1000)`);
      console.log(`[quote:debug]   Infill volume        : ${q.infillVolumeCm3.toFixed(3)} cm³  ((solid − shell) × ${settings.infillPercent}%)`);
      console.log(`[quote:debug]   Model volume         : ${q.modelVolumeCm3.toFixed(3)} cm³`);
      console.log(`[quote:debug]   Support volume       : ${q.supportVolumeCm3.toFixed(3)} cm³  (model × 10% — Bambu tree supports @ 15% density)`);
      console.log(`[quote:debug]   Total printed vol    : ${q.totalPrintedVolumeCm3.toFixed(3)} cm³`);
      console.log(`[quote:debug]   ── Weight (per unit) ──`);
      console.log(`[quote:debug]   Model weight         : ${q.modelWeightGrams.toFixed(2)} g`);
      console.log(`[quote:debug]   Support weight       : ${q.supportWeightGrams.toFixed(2)} g`);
      console.log(`[quote:debug]   Total weight/unit    : ${q.estimatedWeightGrams.toFixed(2)} g`);
      console.log(`[quote:debug]   ── Print time (per unit) ──`);
      console.log(`[quote:debug]   Shell time           : ${Math.round((q.shellVolumeCm3 * 1000) / (11 * layerScale))} s  (11 mm³/s × ${layerScale.toFixed(2)} scale)`);
      console.log(`[quote:debug]   Infill time          : ${Math.round((q.infillVolumeCm3 * 1000) / (20 * layerScale))} s  (20 mm³/s × ${layerScale.toFixed(2)} scale)`);
      console.log(`[quote:debug]   Support time         : ${q.supportPrintTimeMinutes} min  (${Math.round((q.supportVolumeCm3 * 1000) / (20 * layerScale))} s at infill speed)`);
      console.log(`[quote:debug]   Layer overhead       : ${layerCount} layers × 3 s = ${Math.round(layerCount * 3 / 60)} min`);
      console.log(`[quote:debug]   Startup              : 3 min`);
      console.log(`[quote:debug]   Model time/unit      : ${q.modelPrintTimeMinutes} min`);
      console.log(`[quote:debug]   Total time/unit      : ${q.estimatedPrintTimeMinutes} min`);
      console.log(`[quote:debug]   ── Cost breakdown ──`);
      console.log(`[quote:debug]   Material cost        : $${(q.materialCostCents / 100).toFixed(2)}  (${q.estimatedWeightGrams.toFixed(2)} g × ${matCostPerG}/g × qty ${settings.quantity})`);
      console.log(`[quote:debug]   Machine cost         : $${(q.machineCostCents / 100).toFixed(2)}  (${q.estimatedPrintTimeMinutes} min × $2.00/hr × qty ${settings.quantity})`);
      console.log(`[quote:debug]   Setup fee            : $${(q.setupFeeCents / 100).toFixed(2)}`);
      console.log(`[quote:debug]   Support removal      : $${(q.supportRemovalCents / 100).toFixed(2)}${settings.removeSupports ? "  (+20% of material+machine — labour)" : "  (n/a)"}`);
      console.log(`[quote:debug]   Height surcharge     : $${(q.heightSurchargeCents / 100).toFixed(2)}  (${heightMm.toFixed(1)} mm → ${heightPct}% of material+machine)`);
      console.log(`[quote:debug]   SA surcharge         : $${(q.surfaceAreaSurchargeCents / 100).toFixed(2)}  (${surfAreaCm2.toFixed(1)} cm² → ${saPct}% of material)`);
      console.log(`[quote:debug]   ──────────────────────────────────────`);
      console.log(`[quote:debug]   Item total           : $${(q.itemTotalCents / 100).toFixed(2)}`);
    }
    console.log(`\n[quote:debug] ══ Order totals ══`);
    console.log(`[quote:debug]   Subtotal             : $${(quote.subtotalCents / 100).toFixed(2)}`);
    console.log(`[quote:debug]   Shipping             : $${(quote.shippingCents / 100).toFixed(2)}  (${contact.shippingMethod})`);
    console.log(`[quote:debug]   GST (10%)            : $${(quote.gstCents / 100).toFixed(2)}`);
    console.log(`[quote:debug]   TOTAL                : $${(quote.totalCents / 100).toFixed(2)}`);
    console.log(`[quote:debug]   Display print time   : ${quote.displayPrintTimeMinutes} min  (raw × 1.30 buffer, rounded to 5 min)\n`);

    // #6: Generate a one-time checkout token
    const checkoutToken = crypto.randomBytes(32).toString("hex");

    // ── Save order ─────────────────────────────────────────
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
        checkout_token: checkoutToken,
        // #10: Store explicit delivery method instead of inferring from shipping_cents
        delivery_method: contact.shippingMethod ?? "shipping",
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

    const orderNum = String(order.order_number ?? "").padStart(4, "0");
    const customerSlug = slugFileName(contact.customerName).slice(0, 30);
    const folderName = `S3D-${orderNum}_${customerSlug}`;

    // ── Save files + quote inputs, mark uploads consumed ───
    for (let i = 0; i < validatedItems.length; i++) {
      const { item, settings, volumeMm3, actualSizeBytes } = validatedItems[i];
      const itemQuote = itemQuotes[i];

      const safeName = slugFileName(item.originalFilename);
      const newPath = `${folderName}/${safeName}`;

      const { error: moveError } = await supabase.storage
        .from("order-files")
        .move(item.storagePath, newPath);

      const finalPath = moveError ? item.storagePath : newPath;

      const { data: fileRecord } = await supabase
        .from("order_files")
        .insert({
          order_id: order.id,
          original_filename: item.originalFilename,
          storage_path: finalPath,
          mime_type: "model/stl",
          file_size_bytes: actualSizeBytes,
          validation_status: "accepted",
        })
        .select("id")
        .single();

      await supabase.from("quote_inputs").insert({
        order_id: order.id,
        file_id: fileRecord?.id ?? null,
        original_filename: item.originalFilename,
        material: settings.material,
        colour: settings.colour,
        layer_height_mm: settings.layerHeightMm,
        infill_percent: settings.infillPercent,
        quantity: settings.quantity,
        // #10: Store remove_supports explicitly instead of encoding in shipping_method
        remove_supports: settings.removeSupports,
        estimated_volume_cm3: parseFloat((volumeMm3 / 1000).toFixed(2)),
        estimated_print_time_minutes: itemQuote.estimatedPrintTimeMinutes,
        line_total_cents: itemQuote.itemTotalCents,
      });

      // #2: Mark this upload as consumed so it can't be reused
      await supabase
        .from("pending_uploads")
        .update({ consumed: true })
        .eq("storage_path", item.storagePath);
    }

    await supabase.from("order_status_history").insert({
      order_id: order.id,
      status: "draft",
      note: `Draft quote — ${body.items.length} file(s): ${body.items.map(i => i.originalFilename).join(", ")}`,
    });

    return NextResponse.json({
      orderId: order.id,
      checkoutToken,
      ...quote,
    });

  } catch (error) {
    console.error("[quote]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create quote." },
      { status: 500 }
    );
  }
}

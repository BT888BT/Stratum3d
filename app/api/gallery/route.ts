import { NextResponse } from "next/server";
import { createPublicReadClient } from "@/lib/supabase/public-read";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createPublicReadClient();
  const { data: images, error } = await supabase
    .from("gallery_images")
    .select("id, storage_path, caption, sort_order")
    .eq("visible", true)
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[gallery] DB error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!images?.length) {
    return NextResponse.json([]);
  }

  // Generate signed URLs (valid 24 hours)
  const paths = images.map(i => i.storage_path);
  const { data: signedUrls, error: signError } = await supabase.storage
    .from("gallery")
    .createSignedUrls(paths, 86400);

  if (signError) {
    console.error("[gallery] Signed URL error:", signError.message);
    return NextResponse.json({ error: "Failed to load images." }, { status: 500 });
  }

  const result = images.map((img, i) => ({
    ...img,
    url: signedUrls?.[i]?.signedUrl ?? null,
  })).filter(i => i.url);

  return NextResponse.json(result);
}

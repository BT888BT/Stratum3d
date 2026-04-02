import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data: images, error } = await supabase
    .from("gallery_images")
    .select("id, storage_path, caption, sort_order")
    .eq("visible", true)
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate signed URLs for each image (valid 1 hour)
  const withUrls = await Promise.all(
    (images ?? []).map(async (img) => {
      const { data } = await supabase.storage
        .from("gallery")
        .createSignedUrl(img.storage_path, 3600);
      return { ...img, url: data?.signedUrl ?? null };
    })
  );

  return NextResponse.json(withUrls.filter(i => i.url));
}

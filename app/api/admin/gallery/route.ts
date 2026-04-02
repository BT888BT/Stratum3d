import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// GET — list all gallery images for admin (including hidden)
export async function GET() {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const supabase = createAdminClient();
  const { data: images, error } = await supabase
    .from("gallery_images")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate signed URLs
  const withUrls = await Promise.all(
    (images ?? []).map(async (img) => {
      const { data } = await supabase.storage
        .from("gallery")
        .createSignedUrl(img.storage_path, 3600);
      return { ...img, url: data?.signedUrl ?? null };
    })
  );

  return NextResponse.json(withUrls);
}

// POST — upload a new gallery image
export async function POST(request: Request) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const caption = (formData.get("caption") as string) ?? "";

  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  // Validate file type
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG and WebP images are accepted." }, { status: 400 });
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const storagePath = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

  const arrayBuf = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("gallery")
    .upload(storagePath, arrayBuf, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  // Get current max sort_order
  const { data: maxRow } = await supabase
    .from("gallery_images")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const { error: insertError } = await supabase.from("gallery_images").insert({
    storage_path: storagePath,
    caption: caption || null,
    sort_order: (maxRow?.sort_order ?? 0) + 1,
    visible: true,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH — toggle visibility
export async function PATCH(request: Request) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id, visible } = await request.json();
  const supabase = createAdminClient();
  const { error } = await supabase.from("gallery_images").update({ visible }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — remove image from storage and database
export async function DELETE(request: Request) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { id } = await request.json();
  const supabase = createAdminClient();

  // Get storage path first
  const { data: img } = await supabase
    .from("gallery_images")
    .select("storage_path")
    .eq("id", id)
    .single();

  if (img) {
    await supabase.storage.from("gallery").remove([img.storage_path]);
  }

  const { error } = await supabase.from("gallery_images").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

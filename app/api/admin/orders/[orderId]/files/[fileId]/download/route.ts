import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string; fileId: string }> }
) {
  // Defense-in-depth: middleware already guards /api/admin/*, but verify here too
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId, fileId } = await params;

  const supabase = createAdminClient();

  // Confirm the file belongs to this order
  const { data: file, error: fileError } = await supabase
    .from("order_files")
    .select("storage_path, original_filename")
    .eq("id", fileId)
    .eq("order_id", orderId)
    .single();

  if (fileError || !file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Stream the file from Supabase Storage
  const { data: blob, error: downloadError } = await supabase.storage
    .from("order-files")
    .download(file.storage_path);

  if (downloadError || !blob) {
    console.error("[stl-download] Storage download failed:", downloadError?.message);
    return NextResponse.json({ error: "Could not retrieve file" }, { status: 502 });
  }

  const filename = file.original_filename ?? "model.stl";
  const safeFilename = filename.replace(/[^\w.\-]/g, "_");

  return new Response(blob, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
      "Cache-Control": "no-store",
    },
  });
}

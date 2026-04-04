import { NextResponse } from "next/server";
import { createPublicReadClient } from "@/lib/supabase/public-read";

export async function GET() {
  const supabase = createPublicReadClient();
  const { data, error } = await supabase
    .from("colours")
    .select("id, name, hex, available, materials")
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

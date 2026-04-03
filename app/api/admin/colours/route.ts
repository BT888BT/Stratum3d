import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Toggle availability or update materials
export async function PATCH(request: Request) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const { id, available, materials } = await request.json();
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = {};
  if (available !== undefined) updates.available = available;
  if (materials !== undefined) updates.materials = materials;
  const { error } = await supabase.from("colours").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// Add new colour
export async function POST(request: Request) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const { name, hex, materials } = await request.json();
  if (!name || !hex) return NextResponse.json({ error: "name and hex required." }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase.from("colours").insert({ name, hex, available: true, materials: materials ?? null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// Delete colour
export async function DELETE(request: Request) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const { id } = await request.json();
  const supabase = createAdminClient();
  const { error } = await supabase.from("colours").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

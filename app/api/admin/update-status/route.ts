import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedStatuses = [
  "draft",
  "checkout_pending",
  "paid",
  "printing",
  "completed",
  "cancelled"
] as const;

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const adminCookie = cookieStore.get("stratum3d_admin")?.value;

    if (!process.env.ADMIN_PASSWORD || adminCookie !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
    }

    const { orderId, status, note } = await request.json();

    if (!orderId || !status) {
      return NextResponse.json(
        { error: "orderId and status are required." },
        { status: 400 }
      );
    }

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { error: updateError } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const { error: historyError } = await supabase
      .from("order_status_history")
      .insert({
        order_id: orderId,
        status,
        note: note || "Manual admin update"
      });

    if (historyError) {
      throw new Error(historyError.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update order."
      },
      { status: 500 }
    );
  }
}

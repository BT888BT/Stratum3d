import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugFileName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { files } = await request.json() as {
      files: { name: string; size: number }[];
    };

    if (!files?.length) {
      return NextResponse.json({ error: "No files specified." }, { status: 400 });
    }

    const maxSize = 50 * 1024 * 1024;
    for (const f of files) {
      if (f.size > maxSize) {
        return NextResponse.json(
          { error: `"${f.name}" exceeds 50 MB limit.` },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminClient();

    // Generate a batch ID to group files before an order exists
    const batchId = crypto.randomUUID();

    const uploads = await Promise.all(
      files.map(async (f, i) => {
        const safeName = slugFileName(f.name);
        const storagePath = `pending/${batchId}/${Date.now()}-${i}-${safeName}`;

        const { data, error } = await supabase.storage
          .from("order-files")
          .createSignedUploadUrl(storagePath);

        if (error || !data) {
          throw new Error(`Failed to create upload URL for "${f.name}": ${error?.message}`);
        }

        return {
          originalFilename: f.name,
          storagePath,
          signedUrl: data.signedUrl,
          token: data.token,
        };
      })
    );

    return NextResponse.json({ batchId, uploads });
  } catch (error) {
    console.error("[upload-url]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate upload URLs." },
      { status: 500 }
    );
  }
}

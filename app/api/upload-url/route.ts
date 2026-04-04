import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugFileName } from "@/lib/utils";
import { isAllowedFile, maxFileSizeBytes } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getTrustedIp, buildRateLimitKey } from "@/lib/trusted-ip";

export const dynamic = "force-dynamic";

const MAX_FILES_PER_BATCH = 10;

export async function POST(request: Request) {
  try {
    const ip = getTrustedIp(request);
    const rateLimitKey = await buildRateLimitKey("upload", request);

    // Persistent rate limit: 20 upload batches per IP+UA per 15 minutes
    const { allowed } = await checkRateLimit(rateLimitKey, 20, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many upload requests. Please wait a few minutes." },
        { status: 429 }
      );
    }

    const { files } = await request.json() as {
      files: { name: string; size: number }[];
    };

    if (!files?.length) {
      return NextResponse.json({ error: "No files specified." }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_BATCH) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES_PER_BATCH} files per upload.` },
        { status: 400 }
      );
    }

    // Validate filenames and sizes server-side (#3)
    for (const f of files) {
      if (!isAllowedFile(f.name)) {
        return NextResponse.json(
          { error: `"${f.name}": only .stl files are accepted.` },
          { status: 400 }
        );
      }
      if (!f.size || f.size <= 0 || f.size > maxFileSizeBytes) {
        return NextResponse.json(
          { error: `"${f.name}": file must be between 1 byte and 50 MB.` },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminClient();
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

        // Record in pending_uploads table (#2)
        await supabase.from("pending_uploads").insert({
          batch_id: batchId,
          storage_path: storagePath,
          original_filename: f.name,
          file_size_bytes: f.size,
          uploaded: false,
          consumed: false,
          ip_address: ip,
        });

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

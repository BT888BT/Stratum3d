import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugFileName } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Rate limit: max 20 upload batches per IP per 15 minutes
const uploadAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_BATCHES = 20;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FILES_PER_BATCH = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = uploadAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    uploadAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= MAX_BATCHES;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (!checkRateLimit(ip)) {
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

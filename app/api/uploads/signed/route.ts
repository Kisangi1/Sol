import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type SignedUploadFile = {
  filename: string;
  contentType: string;
};

type SignedUploadRequestBody = {
  bucket: "packages" | "destinations";
  files: SignedUploadFile[];
  folder?: string;
};

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as SignedUploadRequestBody;
    if (!body?.bucket || !Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json(
        { error: "Invalid request", details: "bucket and files[] are required" },
        { status: 400 }
      );
    }

    // Basic validation / hardening
    const folder = (body.folder || "").replace(/^\/*/, "").replace(/\.\./g, "");
    const files = body.files.slice(0, 20); // safety limit

    const supabaseAdmin = getSupabaseAdmin();

    const results = await Promise.all(
      files.map(async (f) => {
        const filename = String(f.filename || "");
        const contentType = String(f.contentType || "");

        if (!filename) {
          return { error: "Missing filename" };
        }
        if (!contentType.startsWith("image/")) {
          return { error: "Only image uploads are allowed" };
        }

        const ext = filename.includes(".")
          ? filename.split(".").pop()
          : "bin";

        const path = `${folder ? `${folder}/` : ""}${crypto.randomUUID()}.${ext}`;

        const { data, error } = await supabaseAdmin.storage
          .from(body.bucket)
          .createSignedUploadUrl(path);

        if (error || !data?.signedUrl) {
          return {
            error: "Failed to create signed upload URL",
            details: error?.message,
          };
        }

        const {
          data: { publicUrl },
        } = supabaseAdmin.storage.from(body.bucket).getPublicUrl(path);

        return {
          path,
          token: data.token,
          signedUrl: data.signedUrl,
          publicUrl,
          contentType,
          filename,
        };
      })
    );

    return NextResponse.json({ uploads: results }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      {
        error: "Failed to create signed upload URLs",
        details: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


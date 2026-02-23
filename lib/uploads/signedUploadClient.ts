"use client";

export type UploadBucket = "packages" | "destinations";

export type SignedUploadRequestFile = {
  filename: string;
  contentType: string;
};

export type SignedUploadResult = {
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
  contentType: string;
  filename: string;
};

export async function uploadFilesViaSignedUrls(opts: {
  bucket: UploadBucket;
  files: File[];
  folder?: string;
}): Promise<SignedUploadResult[]> {
  const files = opts.files.filter(Boolean);
  if (files.length === 0) return [];

  const payload = {
    bucket: opts.bucket,
    folder: opts.folder,
    files: files.map(
      (f): SignedUploadRequestFile => ({
        filename: f.name,
        contentType: f.type || "application/octet-stream",
      })
    ),
  };

  const signedRes = await fetch("/api/uploads/signed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!signedRes.ok) {
    const err = await signedRes.json().catch(() => ({}));
    throw new Error(err?.error || err?.details || "Failed to get signed URLs");
  }

  const signedJson = (await signedRes.json()) as { uploads: any[] };
  const uploads = (signedJson.uploads || []) as Array<
    SignedUploadResult & { error?: string; details?: string }
  >;

  // Upload sequentially to reduce bandwidth spikes
  const uploaded: SignedUploadResult[] = [];
  for (let i = 0; i < uploads.length; i++) {
    const u = uploads[i];
    const file = files[i];

    if (!u || (u as any).error) {
      throw new Error((u as any)?.details || (u as any)?.error || "Upload init failed");
    }

    const putRes = await fetch(u.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": u.contentType || file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      throw new Error(`Failed to upload ${file.name} (${putRes.status}): ${text}`);
    }

    uploaded.push(u);
  }

  return uploaded;
}


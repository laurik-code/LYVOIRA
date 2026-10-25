import { verifyAdminCookie } from "../../../../../lib/admin-auth";
// /lyvoira_app/app/api/file/[bucket]/[key]/route.js
// Tier: Pro/Enterprise (Private file proxy)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(req, { params }) {
  if (!verifyAdminCookie(req)) return NextResponse.json({error:"unauthorized"},{status:401});
  const { bucket, key } = params;
  if (!bucket || !key) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const decodedKey = decodeURIComponent(key);

  const { data, error } = await supabase.storage.from(bucket).download(decodedKey);

  if (error || !data) {
    console.error("File proxy error:", error?.message);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = decodedKey.split(".").pop()?.toLowerCase();
  const mime =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "png"
      ? "image/png"
      : ext === "gif"
      ? "image/gif"
      : ext === "webp"
      ? "image/webp"
      : ext === "mp4"
      ? "video/mp4"
      : ext === "webm"
      ? "video/webm"
      : "application/octet-stream";

  return new NextResponse(data, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

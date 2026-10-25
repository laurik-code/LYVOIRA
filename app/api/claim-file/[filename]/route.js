import { verifyAdminCookie } from "../../../../lib/admin-auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// ⚠️ Service Role Key = plný prístup aj pri RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔐 Overenie admin cookie


export async function GET(req, { params }) {
  if (!verifyAdminCookie(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { filename } = params;

  // stiahnutie zo supabase
  const { data, error } = await supabase.storage
    .from("claim-files")
    .download(filename);

  if (error || !data) {
    return NextResponse.json(
      { error: "not_found", message: error?.message || "File not found" },
      { status: 404 }
    );
  }

  // urč typ súboru (mimetype)
  const contentType =
    filename.endsWith(".jpg") || filename.endsWith(".jpeg")
      ? "image/jpeg"
      : filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".mp4")
      ? "video/mp4"
      : "application/octet-stream";

  return new NextResponse(data.stream(), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}

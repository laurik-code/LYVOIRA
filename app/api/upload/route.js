// app/api/upload/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// 🔧 vynútime Node runtime (kvôli Buffer, crypto, service role atď.)
export const runtime = "nodejs";

// ✅ Supabase client (service role – iba na serveri!)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Bezpečný názov súboru
function safeName(original) {
  const parts = (original || "upload.bin").split(".");
  const ext = parts.length > 1 ? "." + parts.pop() : "";
  const base = parts
    .join(".")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_\. ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return `${randomUUID()}-${base}${ext}`;
}

// ✅ Povolené private buckety
const ALLOWED_BUCKETS = new Set(["chat-files-private", "claim-files-private"]);

export async function POST(req) {
  try {
    const form = await req.formData();

    // 🔍 Rozlíšenie kontextu (chat / claim)
    const scope = form.get("scope") || "chat";
    let bucket =
      form.get("bucket") ||
      (scope === "claim" ? "claim-files-private" : "chat-files-private");

    // 🔒 Ochrana: len naše privátne buckety
    if (bucket === "chat-files") bucket = "chat-files-private";
    if (bucket === "claim-files") bucket = "claim-files-private";
    if (!ALLOWED_BUCKETS.has(bucket)) {
      bucket =
        scope === "claim" ? "claim-files-private" : "chat-files-private";
    }

    // Súbory musia byť pod fieldom `files`
    const files = form.getAll("files");
    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: "No files provided (use field name 'files')" },
        { status: 400 }
      );
    }

    if (files.length > 5) return NextResponse.json({success:false,error:"Too many files"},{status:413});
    const uploaded = [];

    for (const item of files) {
      if (!item) continue;

      // 🔁 BACKWARD COMPAT: ak by náhodou prišiel string (napr. už nejaká URL),
      // tak ho len vrátime späť ako "upload", ale nič nenahrávame.
      if (typeof item === "string") return NextResponse.json({success:false,error:"File upload required"},{status:400});

      // Očakávame File/Blob s arrayBuffer()
      if (typeof item.arrayBuffer !== "function") {
        console.warn("[UPLOAD] Unsupported item type:", typeof item);
        continue;
      }

      if (item.size > 5 * 1024 * 1024) return NextResponse.json({success:false,error:"File exceeds 5 MB"},{status:413});
      if (!new Set(["image/jpeg","image/png","image/webp","application/pdf"]).has(item.type)) return NextResponse.json({success:false,error:"Unsupported file type"},{status:415});
      const key = safeName(item.name || "upload.bin");
      const arrayBuffer = await item.arrayBuffer();
      // v Node runtime môžeme kľudne použiť Buffer
      const buffer = Buffer.from(arrayBuffer);
      const mime = item.type || "application/octet-stream";

      // 🚀 Upload do Supabase Storage
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(key, buffer, {
          contentType: mime,
          upsert: false,
        });

      if (upErr) {
        console.error("[UPLOAD] ❌ Error uploading:", upErr);
        return NextResponse.json(
          { success: false, error: upErr.message, bucket },
          { status: 400 }
        );
      }

      // 🧾 Signed URL (platný 30 dní)
      const { data: signed, error: signErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(key, 60 * 10);

      if (signErr) {
        console.error("[UPLOAD] ⚠️ Signed URL error:", signErr);
      }

      const signedUrl = signed?.signedUrl || null;

      uploaded.push({
        bucket,
        key,
        mime,
        size: buffer.length,
        url: signedUrl, // univerzálne pole pre klienta
      });
    }

    if (uploaded.length === 0) {
      return NextResponse.json(
        { success: false, error: "Nothing uploaded" },
        { status: 400 }
      );
    }

    console.log(
      `[UPLOAD] ✅ ${bucket} → ${uploaded
        .map((f) => f.key || f.url || "string-item")
        .join(", ")}`
    );

    return NextResponse.json({
      success: true,
      used_bucket: bucket,
      count: uploaded.length,
      items: uploaded,
      urls: uploaded.map((i) => i.url).filter(Boolean),
      url: uploaded[0]?.url || null, // pre jednoduché použitie (jeden súbor)
    });
  } catch (e) {
    console.error("[UPLOAD] Unexpected error:", e);
    return NextResponse.json(
      { success: false, error: e.message || "Unexpected error" },
      { status: 500 }
    );
  }
}




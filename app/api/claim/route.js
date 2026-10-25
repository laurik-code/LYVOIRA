// app/api/claim/route.js
// Tier: Pro / Enterprise  ✅ (Claim tracking patrí sem)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// ✅ Supabase client (service role)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Bezpečné meno súboru
function safeName(original) {
  const parts = (original || "file.bin").split(".");
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

function norm(s) {
  return (s || "").toString().replace(/\s+/g, " ").trim();
}

function isEmail(s) {
  const v = norm(s);
  return !!v && v.includes("@") && v.length >= 5;
}

function jsonOk(v) {
  try {
    JSON.stringify(v);
    return true;
  } catch {
    return false;
  }
}

/**
 * Zistí, či request je multipart alebo urlencoded.
 * Next.js / Undici môže pri niektorých situáciách hodiť výnimku,
 * takže máme fallback.
 */
async function readFormDataSafe(req) {
  // 1) Skús priamo formData()
  try {
    return await req.formData();
  } catch (e) {
    // 2) Fallback: ak je to urlencoded, načítaj text a premeň
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("application/x-www-form-urlencoded")) {
      const bodyText = await req.text();
      const params = new URLSearchParams(bodyText);
      const fd = new FormData();
      for (const [k, v] of params.entries()) fd.append(k, v);
      return fd;
    }
    // 3) Iné prípady – pošli pôvodnú chybu ďalej
    throw e;
  }
}

export async function POST(req) {
  try {
    const form = await readFormDataSafe(req);

    // 🧠 Honeypot – ochrana pred botmi
    if (norm(form.get("website"))) {
      console.warn("🚫 Bot detected (honeypot triggered)");
      return NextResponse.json({ success: false, error: "bot_detected" }, { status: 400 });
    }

    // 🧩 Dáta z formulára (POVINNÉ)
    const product_id = norm(form.get("product_id"));
    const user_name = norm(form.get("user_name"));
    const user_email = norm(form.get("user_email"));
    const order_id = norm(form.get("order_id"));
    const description = norm(form.get("description"));

    // 🧩 Voliteľné
    const ai_assessment = norm(form.get("ai_assessment"));
    const user_id =
      norm(form.get("user_id")) || "guest_" + Math.random().toString(36).slice(2, 8);

    // ✅ Validácie
    if (!product_id) {
      return NextResponse.json({ success: false, error: "Missing product_id" }, { status: 400 });
    }
    if (!user_name) {
      return NextResponse.json({ success: false, error: "Missing user_name" }, { status: 400 });
    }
    if (!isEmail(user_email)) {
      return NextResponse.json({ success: false, error: "Invalid user_email" }, { status: 400 });
    }
    if (!order_id) {
      return NextResponse.json({ success: false, error: "Missing order_id" }, { status: 400 });
    }
    if (!description || description.length < 8) {
      return NextResponse.json({ success: false, error: "Description too short" }, { status: 400 });
    }

    // 🧾 Prílohy – musia byť povinné
    const files = form.getAll("files") || [];
    if (!files.length) {
      return NextResponse.json(
        { success: false, error: "At least one attachment is required" },
        { status: 400 }
      );
    }

    const uploaded = [];
    const bucket = "claim-files-private";

    for (const f of files) {
      if (!f) continue;

      // ✅ String = URL z chatu
      if (typeof f === "string") {
        const url = norm(f);
        if (!url) continue;
        uploaded.push({
          bucket,
          object_key: null,
          mime: "url/link",
          url,
          source: "chat",
        });
        continue;
      }

      // ✅ File objekt
      if (typeof f.arrayBuffer === "function") {
        const key = safeName(f.name || "file.bin");
        const buffer = Buffer.from(await f.arrayBuffer());
        const mime = f.type || "application/octet-stream";

        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(key, buffer, { contentType: mime, upsert: false });

        if (upErr) {
          console.error("❌ Claim upload error:", upErr.message);
          continue;
        }

        // 🔐 Signed URL (30 dní)
        const { data: signed, error: signErr } = await supabase.storage
          .from(bucket)
          .createSignedUrl(key, 60 * 10);

        if (signErr) {
          console.error("⚠️ Signed URL error:", signErr.message);
        }

        uploaded.push({
          bucket,
          object_key: key,
          mime,
          url: signed?.signedUrl || `/api/file/${bucket}/${key}`,
          source: "upload",
        });
      }
    }

    if (uploaded.length === 0) {
      return NextResponse.json(
        { success: false, error: "Attachments were provided but none could be processed" },
        { status: 400 }
      );
    }

    // 🧩 attachments JSON (na zobrazenie v admin paneli)
    const attachments = uploaded.map((u) => ({
      url: u.url,
      mime: u.mime,
      name: u.object_key ? u.object_key.split("-").slice(1).join("-") : (u.url || "").split("/").pop(),
      source: u.source,
    }));

    // ✅ základný insert payload
    const baseRow = {
      user_id,
      user_name,
      user_email,
      product_id,
      order_id,
      description,
      attachments, // JSON pole
      created_at: new Date().toISOString(),

      // ==============================
      // Claim Tracking (Pro/Enterprise)
      // ==============================
      status: "new",
      updated_at: new Date().toISOString(),
      admin_reply: null,
      admin_reply_at: null,
    };

    // ✅ rozšírený payload (ak máš stĺpce)
    const extendedRow = {
      ...baseRow,
      ai_assessment: ai_assessment || null, // môže byť stĺpec, ale nemusí
    };

    // 🧠 Insert s fallbackom:
    // 1) skúsi extended
    // 2) ak DB povie "column does not exist", skúsi base
    let claimData = null;
    let claimErr = null;

    // Pokus #1 (extended)
    {
      const { data, error } = await supabase
        .from("claims")
        .insert([extendedRow])
        .select()
        .single();

      claimData = data || null;
      claimErr = error || null;
    }

    // Ak padlo na chýbajúcom stĺpci (napr. ai_assessment), retry s base
    if (claimErr) {
      const msg = (claimErr.message || "").toLowerCase();
      const isMissingColumn =
        msg.includes("could not find the") ||
        msg.includes("column") ||
        msg.includes("schema cache") ||
        msg.includes("does not exist");

      if (isMissingColumn) {
        console.warn("⚠️ claims insert retry without optional columns:", claimErr.message);

        const { data, error } = await supabase
          .from("claims")
          .insert([baseRow])
          .select()
          .single();

        claimData = data || null;
        claimErr = error || null;
      }
    }

    if (claimErr) {
      console.error("[CLAIM API] DB error:", claimErr);
      return NextResponse.json(
        { success: false, error: claimErr.message || "DB error" },
        { status: 500 }
      );
    }

    // 🧾 Claim event: created (Pro/Enterprise)
    // (ak tabuľka claim_events ešte neexistuje, nech to NEPADNE)
    try {
      const eventPayload = {
        status: "new",
        has_attachments: true,
        uploaded_count: uploaded.length,
      };

      const { error: evErr } = await supabase
        .from("claim_events")
        .insert([
          {
            claim_id: claimData.id,
            type: "created",
            payload: eventPayload,
            created_by: user_id || "system",
            created_at: new Date().toISOString(),
          },
        ]);

      if (evErr) {
        console.warn("⚠️ claim_events insert skipped:", evErr.message);
      }
    } catch (eEvent) {
      console.warn("⚠️ claim_events insert skipped:", eEvent?.message || eEvent);
    }

    // 🖼️ Ak existujú fyzicky nahrané súbory, skús uložiť do claim_photo (ak tabuľka existuje)
    const photoRecords = uploaded
      .filter((u) => u.object_key)
      .map((u) => ({
        claim_id: claimData.id,
        bucket: u.bucket,
        object_key: u.object_key,
        mime: u.mime,
        url: u.url,
        created_at: new Date().toISOString(),
      }));

    if (photoRecords.length > 0) {
      const { error: photoErr } = await supabase.from("claim_photo").insert(photoRecords);
      if (photoErr) {
        // ak claim_photo tabuľka neexistuje, nechceme padnúť
        console.warn("⚠️ claim_photo insert skipped:", photoErr.message);
      }
    }

    console.log(`✅ Claim uložený: ${claimData.id} (${uploaded.length} príloh)`);

    return NextResponse.json({
      success: true,
      data: claimData,
      uploaded_count: uploaded.length,
      attachments,

      // ==============================
      // Claim Tracking (Pro/Enterprise)
      // ==============================
      tracking: {
        status: claimData.status || "new",
        claim_id: claimData.id,
      },
    });
  } catch (e) {
    console.error("[CLAIM API] Unexpected error:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}

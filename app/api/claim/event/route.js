import { verifyAdminCookie } from "../../../../lib/admin-auth";
// /lyvoira_app/app/api/claim/event/route.js
// Tier: Pro / Enterprise ✅ (Claim tracking)
// Purpose: POST add new event to claim_events (+ optional status update on claims)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ minimal admin guard (nezmaže nič, len chráni v produkcii)
// Ak máš v admin-login nastavený iný cookie name, uprav tu iba názov cookie.
function isAdmin(req) { return verifyAdminCookie(req); }

function norm(v) {
  return (v || "").toString().replace(/\s+/g, " ").trim();
}

function safeJson(v) {
  try {
    // povolíme objekt/array/string/number/bool/null
    JSON.stringify(v);
    return v;
  } catch {
    return null;
  }
}

export async function POST(req) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const claim_id = norm(body?.claim_id);
    const type = norm(body?.type) || "note";
    const created_by = norm(body?.created_by) || "admin";
    const status = norm(body?.status || ""); // optional: when set, also update claims.status
    const payload = safeJson(body?.payload ?? {}) ?? {};

    if (!claim_id) {
      return NextResponse.json({ success: false, error: "Missing claim_id" }, { status: 400 });
    }

    // 1) optionally update claim status (and updated_at)
    //    (nezmaže nič, len doplní tracking)
    if (status) {
      const { error: upErr } = await supabase
        .from("claims")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", claim_id);

      if (upErr) {
        console.warn("[claim/event] claims status update failed:", upErr.message);
        // nechceme hneď padnúť – event sa aj tak môže uložiť
      }
    }

    // 2) insert event
    const { data, error } = await supabase
      .from("claim_events")
      .insert([
        {
          claim_id,
          type,
          payload,
          created_by,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("[claim/event] DB error:", error);
      return NextResponse.json({ success: false, error: error.message || "DB error" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("[claim/event] Unexpected error:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}

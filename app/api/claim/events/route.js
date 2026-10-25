import { verifyAdminCookie } from "../../../../lib/admin-auth";
// /lyvoira_app/app/api/claim/events/route.js
// Tier: Pro / Enterprise ✅ (Claim tracking)
// Purpose: GET timeline/event history for one claim_id

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
  return (v || "").toString().trim();
}

export async function GET(req) {
  try {
    if (!isAdmin(req)) {
      return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const claim_id = norm(searchParams.get("claim_id"));
    const limitRaw = norm(searchParams.get("limit"));
    const limit = Math.min(Math.max(parseInt(limitRaw || "200", 10) || 200, 1), 500);

    if (!claim_id) {
      return NextResponse.json({ success: false, error: "Missing claim_id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("claim_events")
      .select("id, claim_id, type, payload, created_by, created_at")
      .eq("claim_id", claim_id)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("[claim/events] DB error:", error);
      return NextResponse.json({ success: false, error: error.message || "DB error" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (e) {
    console.error("[claim/events] Unexpected error:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}

import { verifyAdminCookie } from "../../../../lib/admin-auth";
// /lyvoira_app/app/api/admin-claim/update/route.js
// Tier: Pro/Enterprise (Claim tracking: status + admin reply + event history)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);



export async function POST(req) {
  if (!verifyAdminCookie(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { claim_id, status, admin_reply } = body || {};

    if (!claim_id) {
      return NextResponse.json(
        { success: false, error: "Missing claim_id" },
        { status: 400 }
      );
    }

    // načítaj pôvodný claim
    const { data: oldClaim, error: oldErr } = await supabase
      .from("claims")
      .select("id, status, admin_reply")
      .eq("id", claim_id)
      .single();

    if (oldErr) {
      return NextResponse.json(
        { success: false, error: oldErr.message },
        { status: 500 }
      );
    }

    // update payload
    const patch = {};

    if (typeof status === "string" && status.trim()) {
      patch.status = status.trim();
    }

    if (typeof admin_reply === "string") {
      patch.admin_reply = admin_reply;
      patch.admin_reply_at = new Date().toISOString();
    }

    // ak nič nemeníme
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: true, unchanged: true });
    }

    const { data: updated, error: upErr } = await supabase
      .from("claims")
      .update(patch)
      .eq("id", claim_id)
      .select()
      .single();

    if (upErr) {
      return NextResponse.json(
        { success: false, error: upErr.message },
        { status: 500 }
      );
    }

    // vytvor event históriu pri zmene statusu
    if (patch.status && patch.status !== oldClaim?.status) {
      await supabase.from("claim_events").insert([
        {
          claim_id,
          event_type: "status_changed",
          label: `Status changed to ${patch.status}`,
          meta: {
            from: oldClaim?.status || null,
            to: patch.status,
          },
          created_at: new Date().toISOString(),
        },
      ]);
    }

    // vytvor event pri admin odpovedi
    if (
      typeof admin_reply === "string" &&
      admin_reply !== (oldClaim?.admin_reply || "")
    ) {
      await supabase.from("claim_events").insert([
        {
          claim_id,
          event_type: "admin_reply",
          label: "Admin reply added",
          meta: {
            reply: admin_reply,
          },
          created_at: new Date().toISOString(),
        },
      ]);
    }

    return NextResponse.json({
      success: true,
      claim: updated,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}
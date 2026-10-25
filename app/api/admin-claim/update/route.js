import { verifyAdminCookie } from "../../../../lib/admin-auth";
// /lyvoira_app/app/api/admin-claims/route.js
// Tier: Pro/Enterprise (Admin claims list)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔐 Overenie admin cookie


export async function GET(req) {
  if (!verifyAdminCookie(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("claims")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ADMIN-CLAIMS] ❌ Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const claims = (data || []).map((c) => ({
    ...c,
    attachments: Array.isArray(c.attachments)
      ? c.attachments
      : typeof c.attachments === "string"
      ? JSON.parse(c.attachments || "[]")
      : [],
  }));

  return NextResponse.json(claims);
}

import { verifyAdminCookie } from "../../../lib/admin-auth";
// /lyvoira_app/app/api/admin-claims/route.js
// Tier: Pro/Enterprise ✅ (Admin claims list + SAFE shop filter)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ UUID check (pre Postgres uuid stĺpce)
function isUuid(v) {
  if (!v) return false;
  const s = String(v).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

// 🔐 Overenie admin cookie


function normalizeClaimRow(c) {
  return {
    ...c,
    attachments: Array.isArray(c.attachments)
      ? c.attachments
      : typeof c.attachments === "string"
      ? (() => {
          try {
            return JSON.parse(c.attachments || "[]");
          } catch {
            return [];
          }
        })()
      : [],
  };
}

export async function GET(req) {
  if (!verifyAdminCookie(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawShop = (url.searchParams.get("shop_id") || "").trim();

  // ✅ Ak shop_id nie je UUID → ignoruj filter (ináč Postgres spadne)
  const shop_id = isUuid(rawShop) ? rawShop : "";

  try {
    let q = supabase
      .from("claims")
      .select("*")
      .order("created_at", { ascending: false });

    if (shop_id) q = q.eq("shop_id", shop_id);

    const { data, error } = await q;

    if (error) {
      console.error("[ADMIN-CLAIMS] ❌ Error:", error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json((data || []).map(normalizeClaimRow), {
      headers: {
        "x-shop-filter": shop_id ? "applied" : rawShop ? "ignored_invalid_uuid" : "none",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

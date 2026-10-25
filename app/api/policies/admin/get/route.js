import { verifyAdminCookie } from "../../../../../lib/admin-auth";
// app/api/policies/admin/get/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(req) {
  if (!verifyAdminCookie(req)) return NextResponse.json({error:"unauthorized"},{status:401});
  try {
    const body = await req.json().catch(() => ({}));
    const { shop_id } = body || {};

    if (!shop_id) {
      return NextResponse.json(
        { success: false, error: "Missing shop_id" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("policy_chunks")
      .select("text, position")
      .eq("shop_id", shop_id);

    if (error) {
      console.error("policies/admin/get supabase error:", error);
      return NextResponse.json(
        { success: false, error: String(error.message || error) },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: true, text: "" });
    }

    const sorted = [...data].sort((a, b) => {
      const pa =
        typeof a.position === "number" && !Number.isNaN(a.position)
          ? a.position
          : 999999;
      const pb =
        typeof b.position === "number" && !Number.isNaN(b.position)
          ? b.position
          : 999999;
      return pa - pb;
    });

    const fullText = sorted.map((row) => row.text || "").join("\n\n");

    return NextResponse.json({ success: true, text: fullText });
  } catch (err) {
    console.error("policies/admin/get error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}

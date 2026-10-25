import { verifyAdminCookie } from "../../../lib/admin-auth";
// app/api/messages/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/**
 * Klienti:
 *  - anonClient: bežné operácie (RLS ON)
 *  - serviceClient: iba pre ADMIN (RLS BYPASSED) – potrebuje SERVICE ROLE KEY
 */
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

const serviceClient =
  process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

/** Overenie admin cookie */


/**
 * GET /api/messages
 * - ADMIN (platná cookie): vráti všetky správy (DESC by created_at)
 * - USER (bez cookie): musí poslať ?user_id=… (voliteľne &conversation_id=…)
 */
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const user_id = url.searchParams.get("user_id");
    const conversation_id = url.searchParams.get("conversation_id") || null;

    const isAdmin = verifyAdminCookie(req);

    // ADMIN → potrebuje serviceClient
    if (isAdmin) {
      if (!serviceClient) {
        return NextResponse.json(
          { success: false, error: "Server not configured (SERVICE ROLE missing)." },
          { status: 500 }
        );
      }
      let q = serviceClient
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (user_id) q = q.eq("user_id", user_id);
      if (conversation_id) q = q.eq("conversation_id", conversation_id);

      const { data, error } = await q;
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // USER → vyžadujeme user_id
    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "Missing user_id or admin rights." },
        { status: 401 }
      );
    }

    let q = anonClient
      .from("messages")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: true });

    if (conversation_id) q = q.eq("conversation_id", conversation_id);

    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[MESSAGES GET] ❌", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const {
      user_id,
      conversation_id = null,
      language = "sk",
      sender,
      message = "",
      file_url = null,
    } = body || {};

    if (!user_id || !sender) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: user_id, sender." },
        { status: 400 }
      );
    }
    if (!message?.trim() && !file_url) {
      return NextResponse.json(
        { success: false, error: "Message must include text or file_url." },
        { status: 400 }
      );
    }

    const { data, error } = await anonClient
      .from("messages")
      .insert([
        {
          user_id,
          conversation_id,
          language,
          sender,
          message: message?.trim() || null,
          file_url: file_url || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    console.log(
      "[MESSAGES POST] saved row id:",
      data?.id,
      "file_url:",
      data?.file_url
    );
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("[MESSAGES POST] ❌ Error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}


import { verifyAdminCookie } from "../../../lib/admin-auth";
import { verifyChatSession } from "../../../lib/chat-session";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const serviceClient = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export async function GET(req) {
  try {
    if (!serviceClient) {
      return NextResponse.json(
        { success: false, error: "Server configuration missing." },
        { status: 500 }
      );
    }

    const url = new URL(req.url);
    const requestedUserId = url.searchParams.get("user_id");
    const conversationId = url.searchParams.get("conversation_id");

    const isAdmin = verifyAdminCookie(req);
    const sessionUserId = isAdmin ? null : verifyChatSession(req);

    if (!isAdmin && !sessionUserId) {
      return NextResponse.json(
        { success: false, error: "Chat session required." },
        { status: 401 }
      );
    }

    if (
      !isAdmin &&
      requestedUserId &&
      requestedUserId !== sessionUserId
    ) {
      return NextResponse.json(
        { success: false, error: "Access denied." },
        { status: 403 }
      );
    }

    let query = serviceClient.from("messages").select("*");

    if (isAdmin) {
      if (requestedUserId) {
        query = query.eq("user_id", requestedUserId);
      }
    } else {
      query = query.eq("user_id", sessionUserId);
    }

    if (conversationId) {
      query = query.eq("conversation_id", conversationId);
    }

    query = query.order("created_at", {
      ascending: !isAdmin,
    });

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[MESSAGES GET]", error);

    return NextResponse.json(
      { success: false, error: "Could not load messages." },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    if (!serviceClient) {
      return NextResponse.json(
        { success: false, error: "Server configuration missing." },
        { status: 500 }
      );
    }

    const sessionUserId = verifyChatSession(req);

    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, error: "Chat session required." },
        { status: 401 }
      );
    }

    const body = await req.json();

    const {
      user_id,
      conversation_id = null,
      language = "sk",
      sender,
      message = "",
      file_url = null,
    } = body || {};

    if (user_id !== sessionUserId) {
      return NextResponse.json(
        { success: false, error: "Access denied." },
        { status: 403 }
      );
    }

    if (!["user", "ai"].includes(sender)) {
      return NextResponse.json(
        { success: false, error: "Invalid sender." },
        { status: 400 }
      );
    }

    if (!message?.trim() && !file_url) {
      return NextResponse.json(
        { success: false, error: "Message or file required." },
        { status: 400 }
      );
    }

    const { data, error } = await serviceClient
      .from("messages")
      .insert({
        user_id: sessionUserId,
        conversation_id,
        language,
        sender,
        message: message?.trim() || null,
        file_url: file_url || null,
        shop_id: process.env.NEXT_PUBLIC_SHOP_ID || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[MESSAGES POST]", error);

    return NextResponse.json(
      { success: false, error: "Could not save message." },
      { status: 500 }
    );
  }
}

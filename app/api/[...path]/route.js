import { verifyAdminCookie } from "../../../lib/admin-auth";
// app/api/file/[...path]/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/**
 * Secure proxy for private storage objects.
 * - Uses SERVICE_ROLE key to generate signed URLs.
 * - Allows access only to:
 *    * Admin (via admin_token cookie)
 *    * Owner of the resource (user_id query param must match owner in messages/claims)
 *
 * Config via env:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - ADMIN_PASSWORD
 * - SIGNED_URL_EXPIRE (optional, seconds, default 600)
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SR_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SIGNED_URL_EXPIRE = Number(process.env.SIGNED_URL_EXPIRE || 600); // default 600s = 10min

if (!SUPABASE_URL || !SR_KEY) {
  console.error("[FILE PROXY] MISSING env NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabaseAdmin = createClient(SUPABASE_URL, SR_KEY, { auth: { persistSession: false } });

// Simple in-memory rate limiter by IP (reset per server run)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // max requests per window per IP



async function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateLimitMap.get(ip) || { count: 0, first: now };
  if (now - entry.first > RATE_LIMIT_WINDOW_MS) {
    entry = { count: 0, first: now };
  }
  entry.count += 1;
  rateLimitMap.set(ip, entry);
  if (entry.count > RATE_LIMIT_MAX) {
    return false;
  }
  return true;
}

/**
 * Helper: find record in chat_photo or claim_photo by bucket/object_key
 * Returns: { type: 'chat'|'claim', row }
 */
async function findAttachmentRecord(bucket, objectKey) {
  // check chat_photo
  const { data: chatRows, error: chatErr } = await supabaseAdmin
    .from("chat_photo")
    .select("id, message_id, bucket, object_key")
    .eq("bucket", bucket)
    .eq("object_key", objectKey)
    .limit(1);

  if (!chatErr && chatRows && chatRows.length > 0) {
    return { type: "chat", row: chatRows[0] };
  }

  // check claim_photo
  const { data: claimRows, error: claimErr } = await supabaseAdmin
    .from("claim_photo")
    .select("id, claim_id, bucket, object_key")
    .eq("bucket", bucket)
    .eq("object_key", objectKey)
    .limit(1);

  if (!claimErr && claimRows && claimRows.length > 0) {
    return { type: "claim", row: claimRows[0] };
  }

  return null;
}

/**
 * GET /api/file/{bucket}/{object_key...}?user_id=...
 * - If admin cookie valid → allowed.
 * - Else require user_id query param and that it equals owner (messages.user_id or claims.user_id).
 */
export async function GET(req, { params }) {
  try {
    // basic path validation
    const segments = params?.path || [];
    if (!segments || segments.length < 2) {
      return NextResponse.json({ success: false, error: "Invalid path. Usage: /api/file/{bucket}/{object_key...}" }, { status: 400 });
    }
    const [bucket, ...rest] = segments;
    const objectKey = rest.join("/");

    // rate limit by IP
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : req.ip || "unknown";
    const okRate = await checkRateLimit(ip);
    if (!okRate) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }

    // admin fast path
    const isAdmin = verifyAdminCookie(req);
    if (isAdmin) {
      const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(objectKey, SIGNED_URL_EXPIRE);
      if (error || !data?.signedUrl) {
        console.error("[FILE PROXY][ADMIN] Signed URL error:", error?.message || data);
        return NextResponse.json({ success: false, error: "Cannot create signed URL" }, { status: 404 });
      }
      const res = NextResponse.redirect(data.signedUrl, 302);
      res.headers.set("Cache-Control", `private, max-age=${Math.min(SIGNED_URL_EXPIRE, 60)}`);
      return res;
    }

    // A user_id query string is not authentication. Never authorize private files with it.
    return NextResponse.json({ success: false, error: "unauthorized" }, { status: 401 });

    // not admin -> must have user_id query param
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");
    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing user_id query param" }, { status: 401 });
    }

    // Find attachment record to determine owner
    const found = await findAttachmentRecord(bucket, objectKey);
    if (!found) {
      // if no record, for security don't reveal which buckets exist
      return NextResponse.json({ success: false, error: "Not found or not authorized" }, { status: 404 });
    }

    if (found.type === "chat") {
      // fetch message owner
      const { data: msgs, error: msgErr } = await supabaseAdmin
        .from("messages")
        .select("id, user_id")
        .eq("id", found.row.message_id)
        .limit(1);

      if (msgErr || !msgs || msgs.length === 0) {
        return NextResponse.json({ success: false, error: "Owner check failed" }, { status: 403 });
      }
      const owner = msgs[0].user_id;
      if (owner !== userId) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    } else {
      // claim
      const { data: cs, error: claimErr } = await supabaseAdmin
        .from("claims")
        .select("id, user_id")
        .eq("id", found.row.claim_id)
        .limit(1);

      if (claimErr || !cs || cs.length === 0) {
        return NextResponse.json({ success: false, error: "Owner check failed" }, { status: 403 });
      }
      const owner = cs[0].user_id;
      if (owner !== userId) {
        return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
      }
    }

    // passed ownership check -> create signed URL
    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(objectKey, SIGNED_URL_EXPIRE);
    if (error || !data?.signedUrl) {
      console.error("[FILE PROXY] Signed URL error:", error?.message || data);
      return NextResponse.json({ success: false, error: "Cannot create signed URL" }, { status: 404 });
    }

    const res = NextResponse.redirect(data.signedUrl, 302);
    res.headers.set("Cache-Control", `private, max-age=${Math.min(SIGNED_URL_EXPIRE, 60)}`);
    return res;
  } catch (err) {
    console.error("[FILE PROXY] ❌", err?.message || err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

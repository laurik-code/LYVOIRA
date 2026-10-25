import { verifyAdminCookie } from "../../../../../lib/admin-auth";
// app/api/policies/admin/save/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rozdelenie veľkého textu na menšie chunky (~1000 znakov)
function splitIntoChunks(text, maxLen = 1000) {
  const paragraphs = (text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let current = "";

  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length <= maxLen) {
      current = current ? current + "\n\n" + p : p;
    } else {
      if (current) chunks.push(current);
      if (p.length <= maxLen) {
        current = p;
      } else {
        // fallback – ak je jeden odstavec brutálne dlhý, rozsekaj ho aj vnútri
        for (let i = 0; i < p.length; i += maxLen) {
          chunks.push(p.slice(i, i + maxLen));
        }
        current = "";
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function POST(req) {
  if (!verifyAdminCookie(req)) return NextResponse.json({error:"unauthorized"},{status:401});
  try {
    const body = await req.json().catch(() => ({}));
    const { shop_id, text } = body || {};

    if (!shop_id || !text) {
      return NextResponse.json(
        { success: false, error: "Missing shop_id or text" },
        { status: 400 }
      );
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return NextResponse.json(
        { success: false, error: "Policy text is empty" },
        { status: 400 }
      );
    }

    const chunks = splitIntoChunks(trimmed, 1200);
    if (chunks.length === 0) {
      return NextResponse.json(
        { success: false, error: "No non-empty chunks produced" },
        { status: 400 }
      );
    }

    // Embeddings – všetky chunky naraz
    const embRes = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunks,
    });

    if (!embRes?.data || embRes.data.length !== chunks.length) {
      return NextResponse.json(
        { success: false, error: "Failed to generate embeddings" },
        { status: 500 }
      );
    }

    // Vymažeme staré chunky pre shop
    const { error: delError } = await supabase
      .from("policy_chunks")
      .delete()
      .eq("shop_id", shop_id);

    if (delError) {
      console.error("DELETE policy_chunks error:", delError);
      // teoreticky môžeme pokračovať, ale je lepšie stopnúť
      return NextResponse.json(
        { success: false, error: String(delError.message || delError) },
        { status: 500 }
      );
    }

    // Pripravíme nové riadky
    const rows = chunks.map((text, idx) => ({
      shop_id,
      text,
      position: idx,
      embedding: embRes.data[idx].embedding,
    }));

    const { error: insError } = await supabase
      .from("policy_chunks")
      .insert(rows);

    if (insError) {
      console.error("INSERT policy_chunks error:", insError);
      return NextResponse.json(
        { success: false, error: String(insError.message || insError) },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      chunksCount: chunks.length,
    });
  } catch (err) {
    console.error("policies/admin/save error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}


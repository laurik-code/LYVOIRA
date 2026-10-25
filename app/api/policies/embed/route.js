import { verifyAdminCookie } from "../../../../lib/admin-auth";
// app/api/policies/embed/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// pomocná funkcia – reálne spravenie embeddings pre daný shop
async function embedForShop(shopId) {
  // 1) načítaj všetky chunky bez embeddingu
  const { data, error } = await supabase
    .from("policy_chunks")
    .select("id, text")
    .eq("shop_id", shopId)
    .is("embedding", null);

  if (error) {
    console.error("❌ Supabase select error:", error);
    throw new Error("DB select failed");
  }

  if (!data || data.length === 0) {
    return { done: 0, message: "No chunks without embedding for this shop." };
  }

  // Môžeme embedovať naraz, lebo chunkov je málo (tvoje demo má ~9)
  const texts = data.map((row) => row.text || "");

  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
  });

  if (!embRes?.data || embRes.data.length !== data.length) {
    throw new Error("Embedding response length mismatch");
  }

  // 2) update každého riadku embeddingom
  let updatedCount = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const emb = embRes.data[i].embedding;

    const { error: upErr } = await supabase
      .from("policy_chunks")
      .update({ embedding: emb })
      .eq("id", row.id);

    if (upErr) {
      console.error("❌ Supabase update error for id", row.id, upErr);
      continue;
    }
    updatedCount++;
  }

  return { done: updatedCount, message: "Embeddings generated." };
}

// ✅ GET /api/policies/embed?shop_id=...
export async function GET(req) {
  if (!verifyAdminCookie(req)) return NextResponse.json({error:"unauthorized"},{status:401});
  try {
    const { searchParams } = new URL(req.url);
    const shopId = searchParams.get("shop_id");

    if (!shopId) {
      return NextResponse.json(
        { success: false, error: "Missing shop_id in query params" },
        { status: 400 }
      );
    }

    const result = await embedForShop(shopId);

    return NextResponse.json({
      success: true,
      shop_id: shopId,
      ...result,
    });
  } catch (err) {
    console.error("❌ /api/policies/embed GET error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}

// ✅ POST /api/policies/embed  { "shop_id": "..." }
export async function POST(req) {
  if (!verifyAdminCookie(req)) return NextResponse.json({error:"unauthorized"},{status:401});
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { shop_id: shopId } = body || {};

    if (!shopId) {
      return NextResponse.json(
        { success: false, error: "Missing shop_id in JSON body" },
        { status: 400 }
      );
    }

    const result = await embedForShop(shopId);

    return NextResponse.json({
      success: true,
      shop_id: shopId,
      ...result,
    });
  } catch (err) {
    console.error("❌ /api/policies/embed POST error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}

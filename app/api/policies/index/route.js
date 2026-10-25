import { verifyAdminCookie } from "../../../../lib/admin-auth";
// app/api/policies/index/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🧠 Rozdelenie textu na chunky (~800 znakov)
function splitToChunks(text, size = 800) {
  const chunks = [];
  for (let i = 0; i < text.length; i += size) {
    const part = text.slice(i, i + size).trim();
    if (part) chunks.push(part);
  }
  return chunks;
}

export async function POST(req) {
  if (!verifyAdminCookie(req)) return NextResponse.json({error:"unauthorized"},{status:401});
  try {
    console.log("🟣 DEBUG – Env check");
    console.log("🔑 OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ YES" : "❌ NO");

    const body = await req.json();
    // Never log full customer policy content in production.

    const { shop_id, title, raw_text } = body;

    if (!shop_id || !raw_text)
      return NextResponse.json({ success: false, error: "Missing shop_id or text" }, { status: 400 });

    // 🔹 Rozdelenie textu
    const chunks = splitToChunks(raw_text);
    console.log(`📄 Text rozdelený na ${chunks.length} častí`);

    // 🔹 Vytvorenie embeddingov
    const embedRes = await axios.post(
      "https://api.openai.com/v1/embeddings",
      {
        model: "text-embedding-3-small",
        input: chunks,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const vectors = embedRes.data.data.map((d) => d.embedding);

    // 🔹 Vložíme záznam do policy_docs
    const { data: doc, error: docError } = await supabase
      .from("policy_docs")
      .insert([{ shop_id, title, raw_text }])
      .select()
      .single();

    if (docError) throw docError;

    // 🔹 Uložíme všetky chunky s embeddingmi
    const rows = chunks.map((text, i) => ({
      shop_id,
      doc_id: doc.id,
      chunk_index: i,
      text,
      embedding: vectors[i],
    }));

    const { error: chunkError } = await supabase.from("policy_chunks").insert(rows);
    if (chunkError) throw chunkError;

    console.log("✅ Uložené do policy_docs a policy_chunks");

    return NextResponse.json({
      success: true,
      shop_id,
      doc_id: doc.id,
      chunks: rows.length,
    });
  } catch (err) {
    console.error("❌ Policy index error:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}



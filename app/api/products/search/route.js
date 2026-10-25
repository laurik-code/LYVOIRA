// app/api/products/search/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.toLowerCase() || "";

    if (!q || q.length < 2) {
      return NextResponse.json({ items: [] });
    }

    // vyhľadávanie podľa názvu alebo popisu
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .ilike("name", `%${q}%`)
      .limit(5);

    if (error) throw error;

    // ak nič nenašlo podľa názvu, skúsime popis
    let results = data;
    if (results.length === 0) {
      const { data: descData, error: descErr } = await supabase
        .from("products")
        .select("*")
        .ilike("description", `%${q}%`)
        .limit(5);
      if (descErr) throw descErr;
      results = descData;
    }

    // pridáme falošný troubleshooting text (v praxi by bol v DB v extra stĺpci)
    const withTips = results.map((item) => ({
      ...item,
      troubleshooting:
        item.name.includes("Mug") || item.name.includes("Hrnček")
          ? "☕ Skontroluj, či nie je prasknutý. Ak áno, môžeš podať reklamáciu."
          : item.name.includes("Backpack") || item.name.includes("Batoh")
          ? "🎒 Over, či zips nie je zaseknutý. Skús jemne pretrieť voskom."
          : "ℹ️ Pre tento produkt zatiaľ nemáme konkrétne tipy.",
    }));

    return NextResponse.json({ items: withTips });
  } catch (err) {
    console.error("[PRODUCT SEARCH API] Error:", err.message);
    return NextResponse.json({ error: "db_failed", message: err.message }, { status: 500 });
  }
}

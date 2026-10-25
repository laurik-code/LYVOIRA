import { verifyAdminCookie } from "../../../lib/admin-auth";
// /lyvoira_app/app/api/stats/route.js
// Tier: Pro/Enterprise ✅ (Admin analytics - ALL TIME)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// normalize product for grouping "similar name" (best-effort)
function normProduct(s) {
  const raw = (s || "").toString().trim().toLowerCase();
  if (!raw) return "n/a";

  // remove url parts
  let v = raw.replace(/^https?:\/\/(www\.)?/g, "");
  v = v.replace(/[#?].*$/g, "");

  // remove diacritics
  v = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // replace separators
  v = v.replace(/[_\-+]/g, " ");
  v = v.replace(/[^a-z0-9 ]/g, " ");
  v = v.replace(/\s+/g, " ").trim();

  // tiny stopwords
  v = v
    .split(" ")
    .filter((w) => w && !["produkt", "tovar", "item", "the", "a", "an"].includes(w))
    .join(" ")
    .trim();

  return v || "n/a";
}

export async function GET(req) {
  if (!verifyAdminCookie(req)) return NextResponse.json({error:"unauthorized"},{status:401});
  try {
    // total overall (presný count)
    const { count: totalCount, error: countErr } = await supabase
      .from("claims")
      .select("*", { count: "exact", head: true });

    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    // načítame všetky claimy pre agregácie (len potrebné stĺpce)
    // language môže byť missing -> fallback cez retry
    let rows = [];
    let hasLanguage = true;

    // pokus s language
    {
      const { data, error } = await supabase
        .from("claims")
        .select("id, product_id, user_name, user_email, created_at, language");

      if (error) {
        // fallback bez language
        hasLanguage = false;
        const { data: data2, error: error2 } = await supabase
          .from("claims")
          .select("id, product_id, user_name, user_email, created_at");

        if (error2) {
          return NextResponse.json({ error: error2.message }, { status: 500 });
        }
        rows = data2 || [];
      } else {
        rows = data || [];
      }
    }

    const byLang = {};
    const byDay = {}; // { "YYYY-MM-DD": { cnt, examples[] } }

    // top products with normalization + keep most frequent display variant
    const prodGroups = {}; // key -> { cnt, variants: {orig:cnt} }
    const prodDisplay = {}; // key -> best display

    for (const r of rows || []) {
      const day = r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : "n/a";
      if (!byDay[day]) byDay[day] = { cnt: 0, examples: [] };
      byDay[day].cnt += 1;

      // store a few examples for hover/click
      if (byDay[day].examples.length < 3) {
        byDay[day].examples.push({
          id: r.id,
          product_id: r.product_id || "n/a",
          user_email: r.user_email || "n/a",
          user_name: r.user_name || "n/a",
        });
      }

      if (hasLanguage) {
        const lang = (r.language || "n/a").toString();
        byLang[lang] = (byLang[lang] || 0) + 1;
      }

      const original = (r.product_id || "n/a").toString();
      const key = normProduct(original);

      if (!prodGroups[key]) prodGroups[key] = { cnt: 0, variants: {} };
      prodGroups[key].cnt += 1;
      prodGroups[key].variants[original] = (prodGroups[key].variants[original] || 0) + 1;
    }

    // build top products all time
    const topAll = Object.entries(prodGroups)
      .map(([k, v]) => {
        // pick most common variant as display name
        const best = Object.entries(v.variants).sort((a, b) => b[1] - a[1])[0]?.[0] || k;
        prodDisplay[k] = best;
        return { key: k, product_id: best, cnt: v.cnt };
      })
      .sort((a, b) => b.cnt - a.cnt);

    // build days list sorted asc
    const daysAll = Object.entries(byDay)
      .filter(([d]) => d !== "n/a")
      .sort((a, b) => new Date(a[0]) - new Date(b[0]))
      .map(([date, obj]) => ({
        date,
        cnt: obj.cnt,
        examples: obj.examples,
      }));

    return NextResponse.json({
      total: totalCount ?? 0,
      by_language: hasLanguage ? byLang : {},
      has_language: hasLanguage,
      top_products_all: topAll, // ALL TIME, scroll v dashboard
      days_all: daysAll,        // ALL TIME grid
    });
  } catch (e) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

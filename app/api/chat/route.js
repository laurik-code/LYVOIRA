// app/api/chat/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ✅ embeddings model (RAG)
const OPENAI_EMBED_MODEL =
  process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";

// ✅ cache per shop_id na policies text/rows
const POLICY_CACHE = globalThis.__LYVOIRA_POLICY_CACHE__ || new Map();
globalThis.__LYVOIRA_POLICY_CACHE__ = POLICY_CACHE;

function getLangCode(input) {
  const code = (input || "").toLowerCase().split(/[-_]/)[0];
  return code || "en";
}

function normalizePolicyText(text) {
  if (!text) return "";
  return String(text).replace(/\r\n/g, "\n").trim();
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// ✅ parse embedding stored as string like "[0.1,0.2,...]"
function parseEmbedding(val) {
  if (!val) return null;
  if (Array.isArray(val)) return val.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  if (typeof val === "string") {
    const parsed = safeJsonParse(val);
    if (Array.isArray(parsed)) return parsed.map((x) => Number(x)).filter((n) => Number.isFinite(n));
  }
  return null;
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return -1;
  return dot / denom;
}

async function getQueryEmbedding(text) {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
  const input = String(text || "").slice(0, 4000);

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_EMBED_MODEL,
      input,
    }),
  });

  const txt = await res.text();
  if (!res.ok) throw new Error(`OpenAI embeddings error: ${res.status} ${txt}`);

  const json = safeJsonParse(txt);
  const emb = json?.data?.[0]?.embedding;
  if (!Array.isArray(emb)) return null;
  return emb.map((x) => Number(x));
}

/**
 * ✅ Natiahni chunk-y policies (aj s embedding)
 * - stĺpce: shop_id, text, position, chunk_index, created_at, embedding, doc_id, id
 *
 * POZN: nepoznám názov tabuľky, tak skúšam viac kandidátov.
 * Keď mi povieš presný názov tabuľky, nechám tam iba jeden.
 */
async function fetchShopPoliciesFromChunks(shop_id) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { rows: [], text: "", source: "no-supabase" };
  }

  // cache 10 min
  const cached = POLICY_CACHE.get(shop_id);
  if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
    return { rows: cached.rows || [], text: cached.text || "", source: cached.source || "cache" };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ✅ kandidáti názvov tabuliek
  const candidates = [
    "policy_embeddings",
    "policies_embeddings",
    "policy_chunks",
    "shop_policy_chunks",
    "policies_chunks",
    "documents_chunks",
    "docs_chunks",
    "shop_docs_chunks",
    "shop_policies_chunks",
  ];

  let rows = null;
  let usedTable = null;

  for (const table of candidates) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select("shop_id,text,position,chunk_index,created_at,doc_id,id,embedding")
        .eq("shop_id", shop_id)
        .order("position", { ascending: true })
        .order("chunk_index", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(1500);

      if (error) continue;
      if (Array.isArray(data) && data.length > 0) {
        rows = data;
        usedTable = table;
        break;
      }
    } catch {
      // ignore
    }
  }

  const normalizedRows = Array.isArray(rows)
    ? rows
        .map((r) => {
          const text = r?.text ? String(r.text).trim() : "";
          const emb = parseEmbedding(r?.embedding);
          return {
            ...r,
            text,
            embedding: emb,
          };
        })
        .filter((r) => r.text)
    : [];

  const policyText = normalizePolicyText(
    normalizedRows.map((r) => r.text).join("\n\n")
  );

  POLICY_CACHE.set(shop_id, {
    ts: Date.now(),
    rows: normalizedRows,
    text: policyText,
    source: usedTable ? `chunks:${usedTable}` : "chunks:empty",
  });

  return {
    rows: normalizedRows,
    text: policyText,
    source: usedTable ? `chunks:${usedTable}` : "chunks:empty",
  };
}

/**
 * ✅ Vyber relevantné chunk-y cez cosine similarity (RAG)
 * - ak embeddingy chýbajú, spraví fallback jednoduchým keyword matchom
 */
async function selectRelevantPolicyChunks({ rows, userText, topK = 6 }) {
  const clean = String(userText || "").trim();
  if (!clean) return { chunks: [], method: "none" };

  const hasEmbeddings = Array.isArray(rows) && rows.some((r) => Array.isArray(r.embedding) && r.embedding.length > 10);

  // ✅ embedding RAG
  if (hasEmbeddings) {
    const qEmb = await getQueryEmbedding(clean);
    if (Array.isArray(qEmb) && qEmb.length > 10) {
      const scored = rows
        .map((r) => {
          const sim = cosineSimilarity(qEmb, r.embedding);
          return { r, sim };
        })
        .filter((x) => Number.isFinite(x.sim))
        .sort((a, b) => b.sim - a.sim)
        .slice(0, topK);

      const chunks = scored.map((x) => x.r);
      return { chunks, method: "embedding" };
    }
  }

  // ✅ fallback: keyword match
  const keywords = clean
    .toLowerCase()
    .replace(/[^a-z0-9áäčďéíĺľňóôŕšťúýž\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12);

  if (!keywords.length) return { chunks: [], method: "none" };

  const scored = rows
    .map((r) => {
      const t = (r.text || "").toLowerCase();
      let score = 0;
      for (const kw of keywords) if (t.includes(kw)) score += 1;
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return { chunks: scored.map((x) => x.r), method: "keyword" };
}

function formatPolicyContext(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) return "";

  // krátky, ale jasný kontext (bez obrovských blokov)
  // + pridáme “meta” aby sa dalo povedať “v podmienkach je…”
  const parts = chunks.map((c, idx) => {
    const meta = [
      c?.doc_id ? `doc_id=${c.doc_id}` : null,
      Number.isFinite(c?.chunk_index) ? `chunk=${c.chunk_index}` : null,
      Number.isFinite(c?.position) ? `pos=${c.position}` : null,
      c?.id ? `id=${c.id}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const text = normalizePolicyText(c?.text || "");
    return `[#${idx + 1}${meta ? ` (${meta})` : ""}]\n${text}`;
  });

  return parts.join("\n\n");
}

function buildSystemPrompt({ policyContext, languageCode, supportEmail }) {
  return `
You are Lyvoira customer-support assistant for an e-shop.

LANGUAGE:
- You MUST answer in the user's language (language code: ${languageCode}).
- Do NOT switch languages unless the user switches.

GROUNDING / NO HALLUCINATION:
- You have access ONLY to the relevant excerpts from the store's Terms & Conditions / Policies below.
- If the user asks something that is NOT explicitly present in the excerpts, you MUST say you cannot see that info in the provided policies and ask the minimum missing details.
- Never invent delivery times, refund windows, warranty rules, fees, addresses, or legal statements.

STYLE:
- Be concise. Avoid repeating the same checklist multiple times.
- If claim/return intent: include checklist ONCE and keep it short.

OUTPUT FORMAT (ALWAYS):
Return the final answer with 3 sections:
BASIC: short direct answer
PRO: clearer explanation + what you need from customer (minimum needed details)
ENTERPRISE: internal/admin notes (what staff should check in systems, what to log, message templates)

CLAIMS / RETURNS:
- If the user intent seems like return/claim/warranty, include a short checklist (order number + photo/video + description + preference refund/exchange) and mention the claim form (/claims) if relevant.

SUPPORT:
- You may reference this support email: ${supportEmail || "not provided"}.

Relevant policy excerpts:
"""
${policyContext || "(NO RELEVANT POLICY EXCERPTS FOUND FOR THIS QUESTION)"}
"""
`.trim();
}

async function callOpenAI({ system, messages }) {
  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

  const payload = {
    model: OPENAI_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      ...messages,
      {
        role: "user",
        content:
          "Return ONLY a JSON object with fields: reply (string), intent (string: general|claim|return|order|shipping|payment|other), detected_language_code (string). No markdown fences.",
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const txt = await res.text();
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${txt}`);

  const json = safeJsonParse(txt);
  const content = json?.choices?.[0]?.message?.content || "";

  let parsed = safeJsonParse(content);
  if (!parsed) {
    const m = content.match(/\{[\s\S]*\}$/);
    if (m) parsed = safeJsonParse(m[0]);
  }

  if (parsed?.reply) return parsed;

  return { reply: content || "", intent: "general", detected_language_code: "" };
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { shop_id, history, browserLanguage, uiLanguage, supportEmail } = body || {};

    if (!shop_id) {
      return NextResponse.json({ success: false, error: "Missing shop_id." }, { status: 400 });
    }

    // ✅ Jazyk: UI > browser > fallback
    const langCode = getLangCode(uiLanguage || browserLanguage || "en");

    // ✅ 1) natiahni policies (chunks)
    const pol = await fetchShopPoliciesFromChunks(shop_id);
    const rows = Array.isArray(pol?.rows) ? pol.rows : [];

    // ✅ 2) história pre AI
    const msgs = Array.isArray(history)
      ? history
          .filter(
            (m) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string"
          )
          .slice(-30)
      : [];

    // ✅ posledná user správa = query pre RAG
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    const lastUserText = String(lastUser?.content || "").trim();

    // ✅ 3) vyber relevantné chunk-y (embedding / keyword fallback)
    const sel = await selectRelevantPolicyChunks({
      rows,
      userText: lastUserText,
      topK: 6,
    });

    const policyContext = formatPolicyContext(sel?.chunks || []);

    const system = buildSystemPrompt({
      policyContext,
      languageCode: langCode,
      supportEmail,
    });

    // ✅ 4) AI pri každej správe
    const ai = await callOpenAI({ system, messages: msgs });

    const reply = String(ai?.reply || "").trim();
    const intent = String(ai?.intent || "general").trim();
    const detected_language_code = String(ai?.detected_language_code || langCode).trim();

    return NextResponse.json({
      success: true,
      reply: reply || "",
      intent: intent || "general",
      detected_language_code,
      policy_source: pol?.source || "",
      rag_method: sel?.method || "",
      rag_chunks_used: Array.isArray(sel?.chunks) ? sel.chunks.length : 0,
      uiLanguage: uiLanguage || null,
      policy_loaded_chars: (pol?.text || "").length,
    });
  } catch (err) {
    console.error("[API CHAT] ❌", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}


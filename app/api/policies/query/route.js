// app/api/policies/query/route.js
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return 0;
  const dot = a.reduce((sum, v, i) => sum + v * (b[i] || 0), 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

function normalize(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function norm(s) {
  return (s || "").toString().replace(/\s+/g, " ").trim();
}

async function detectLanguageUniversal(text) {
  const input = (text || "").slice(0, 2000);
  if (!input) return "sk";

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 5,
      messages: [
        {
          role: "system",
          content:
            "Detect the language of the user text and answer ONLY the ISO 639-1 language code (like 'sk', 'en', 'de', 'cs', 'hu'). No explanation, just the code.",
        },
        { role: "user", content: input },
      ],
    });

    let code = completion?.choices?.[0]?.message?.content?.trim().toLowerCase() || "";
    if (code.length > 2) code = code.slice(0, 2);
    return code || "sk";
  } catch (e) {
    console.warn("detectLanguageUniversal error:", e);
    return "sk";
  }
}

function isClaimQuestion(text) {
  const t = normalize(text);
  return (
    /reklamac/.test(t) ||
    /vratit\s+tovar/.test(t) ||
    /vratenie\s+tovaru/.test(t) ||
    /vratenie\s+penaz/.test(t) ||
    /refund/.test(t) ||
    /complaint/.test(t) ||
    /warranty/.test(t) ||
    /claim/.test(t)
  );
}

function isShippingQuestion(text) {
  const n = normalize(text);

  const hasTimeWord =
    n.includes("kedy") ||
    n.includes("dokedy") ||
    n.includes("ako dlho") ||
    n.includes("how long") ||
    /when\s+will/.test(n);

  const hasShippingWord =
    n.includes("balik") ||
    n.includes("baliik") ||
    n.includes("balicek") ||
    n.includes("zasielk") ||
    n.includes("objednavk") ||
    n.includes("dorucen") ||
    n.includes("doprava") ||
    n.includes("delivery") ||
    n.includes("shipping") ||
    n.includes("parcel") ||
    n.includes("package");

  if (hasTimeWord && hasShippingWord) return true;
  if (/kedy\s+mi\s+pr[ie]de\s+bal/i.test(n)) return true;

  return false;
}

function claimChecklist(lang) {
  if (lang === "sk") {
    return (
      "Čo si pripraviť na reklamáciu:\n" +
      "• číslo objednávky,\n" +
      "• krátky popis problému (čo presne je poškodené alebo nefunkčné),\n" +
      "• 1–2 fotky alebo krátke video poškodeného tovaru a/alebo balenia,\n" +
      "• informáciu, či chceš vrátenie peňazí alebo výmenu tovaru,\n" +
      "• kontaktné údaje (e-mail, telefón)."
    );
  }

  return (
    "What you should prepare for a claim:\n" +
    "• your order number,\n" +
    "• a short description of the issue,\n" +
    "• 1–2 photos or a short video of the damaged product/packaging,\n" +
    "• whether you want a refund or an exchange,\n" +
    "• your contact details (e-mail, phone)."
  );
}

function shippingFallback(lang) {
  if (lang === "sk") {
    return (
      "Kedy presne ti balík príde, závisí od dopravcu a dátumu odoslania. Odporúčam:\n" +
      "• skontrolovať potvrdzovací e-mail (tracking / odhad dodania),\n" +
      "• ak máš tracking, pozri stav priamo u dopravcu,\n" +
      "• pošli mi číslo objednávky + dopravcu/tracking a poviem ti presnejší postup."
    );
  }

  return (
    "The exact delivery time depends on the carrier and the dispatch date.\n" +
    "• Check your order confirmation e-mail (tracking/estimate),\n" +
    "• use the tracking link on the carrier website,\n" +
    "• send your order number + carrier/tracking and I’ll guide you precisely."
  );
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { shop_id, question } = body;

    if (!shop_id || !question) {
      return NextResponse.json(
        { success: false, error: "Missing shop_id or question" },
        { status: 400 }
      );
    }

    const lang = (await detectLanguageUniversal(question)) || "sk";
    const claimQ = isClaimQuestion(question);
    const shippingQ = isShippingQuestion(question);

    // 1) Embed otázku
    let qEmb = null;
    try {
      const embRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: question,
      });
      qEmb = embRes?.data?.[0]?.embedding || null;
    } catch (e) {
      console.error("❌ Embedding error:", e);
    }

    // 2) Načítaj chunks z DB
    let chunks = [];
    if (qEmb) {
      try {
        const { data, error } = await supabase
          .from("policy_chunks")
          .select("text, embedding")
          .eq("shop_id", shop_id);

        if (!error && Array.isArray(data)) chunks = data;
      } catch (e) {
        // table may not exist
        chunks = [];
      }
    }

    // 3) Similarity
    let context = "";
    let topScore = 0;

    if (qEmb && chunks.length > 0) {
      const scored = chunks
        .map((c) => ({
          text: c.text,
          score: cosineSimilarity(qEmb, c.embedding),
        }))
        .sort((a, b) => b.score - a.score);

      topScore = scored[0]?.score || 0;

      if (topScore >= 0.15) {
        const topChunks = scored.slice(0, 3);
        context = topChunks.map((c) => c.text).join("\n\n");
      }
    }

    // 4) Ak nemáme relevantný kontext → fallback
    if (!context) {
      let answer = "";

      if (shippingQ) {
        answer = shippingFallback(lang);
      } else if (claimQ) {
        answer =
          (lang === "sk"
            ? "V podmienkach nevidím úplne presný bod pre tento prípad. Zvyčajne však reklamáciu vybaví e-shop podľa bežného postupu.\n\n"
            : "I can’t see an exact matching point in the policies for this case. Typically, the shop will follow a standard claim process.\n\n") +
          claimChecklist(lang === "sk" ? "sk" : "en");
      } else {
        answer =
          lang === "sk"
            ? "K tejto otázke nevidím v obchodných podmienkach presne rovnaký bod. Pošli mi prosím viac detailov (čo presne riešiš) a poradím ti."
            : "I can’t see a direct matching point in the shop policies. Please share more details and I’ll guide you.";
      }

      return NextResponse.json({
        success: true,
        language: lang,
        answer,
        topScore,
      });
    }

    // 5) Máme kontext → zavoláme OpenAI
    const systemPrompt =
      lang === "sk"
        ? "Si asistent pre e-shop. Odpovedaj PRIMÁRNE podľa poskytnutých obchodných podmienok. Nevymýšľaj fakty, ktoré tam nie sú. Ak niečo nie je špecifikované, povedz to a popíš bežnú prax. Odpovedaj v jazyku zákazníka."
        : "You are an e-commerce assistant. Answer PRIMARILY from the provided shop policies. Do not invent facts that are not present. If something is not specified, say so and describe common practice. Reply in the user's language.";

    const userPrompt =
      lang === "sk"
        ? `Otázka zákazníka: "${question}"\n\nRelevantné časti obchodných podmienok:\n${context}`
        : `Customer question: "${question}"\n\nRelevant parts of the store policies:\n${context}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 350,
    });

    let answerRaw = completion?.choices?.[0]?.message?.content?.trim() ?? "";
    let answer =
      answerRaw && answerRaw.length > 1
        ? answerRaw
        : lang === "sk"
        ? "K tejto otázke nie je v obchodných podmienkach uvedená presná informácia."
        : "There is no exact information about this in the store policies.";

    if (claimQ) {
      const checklistText = claimChecklist(lang === "sk" ? "sk" : "en");
      const lower = answer.toLowerCase();
      if (!lower.includes("čo si pripraviť") && !lower.includes("what you should prepare")) {
        answer = answer + "\n\n" + checklistText;
      }
    }

    if (shippingQ) {
      const lower = answer.toLowerCase();
      const veryShort = answer.replace(/\s+/g, "").length < 60;
      const looksLikeNoInfo =
        /nie je.*uveden[ée]/.test(lower) ||
        /not\s+mentioned/.test(lower) ||
        /not\s+specified/.test(lower);

      if (veryShort || looksLikeNoInfo) {
        answer = shippingFallback(lang);
      }
    }

    return NextResponse.json({
      success: true,
      language: lang,
      answer,
      topScore,
    });
  } catch (err) {
    console.error("❌ Policy query error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}


import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Tento endpoint má jedinú úlohu:
 *  - vezme JEDNU správu od zákazníka
 *  - AI vráti štruktúrovaný JSON s jazykom, intentom, číslom objednávky, refund/exchange, YES/NO atď.
 *
 * Môžeš ho používať v ľubovoľnom jazyku – AI si jazyk správy zistí sama.
 */

const SYSTEM_PROMPT = `
You are a classifier for an e-commerce customer support chat.

You will receive a JSON object with:
{
  "userMessage": string,          // the latest user message
  "browserLanguage": string|null, // browser UI language hint (e.g. "sk-SK", "en-US", "de-DE")
  "previousLanguage": string|null // language code the bot used so far (e.g. "sk", "en")
}

Your job:
1. Detect the LANGUAGE the user is writing in (from userMessage). Use a two-letter lower-case language code like "sk", "en", "de", "cs", "es", ...
   - Prefer the actual language of userMessage, not the browserLanguage.
2. Detect the main INTENT of the message from the e-commerce point of view:
   - "complaint"        – damaged product, wants to complain or report an issue
   - "return"           – wants to return an item without damage (e.g. doesn't like, wrong size)
   - "shipping"         – asks about delivery, shipping, tracking, when parcel will arrive, courier, shipping costs etc.
   - "order_status"     – asks about a specific order (status, change, cancel), not necessarily shipping
   - "product_question" – asks about product parameters, availability, colors, sizes, etc.
   - "smalltalk"        – "hi", "hello", "how are you", casual chat
   - "other"            – anything else
3. Detect whether the message is about a CLAIM / COMPLAINT:
   - is_claim_intent: true if user wants to complain about a product or start claim process (damaged, faulty, wrong item, etc.), otherwise false.
4. Detect whether the message is about SHIPPING / DELIVERY:
   - is_shipping_question: true if the main topic is delivery / shipping / parcel / when it arrives etc.
5. Detect whether user explicitly wants to START a claim process or open a claim form:
   - wants_claim_form: true if user says things like "I want to make a claim", "I want to start a complaint", "open claim form", etc.
6. Extract ORDER ID if present:
   - mentions_order_number: true if some token looks like an order number (contains digits and length >= 5-6 characters)
   - order_id: string with the best guess, or null if none.
7. Detect RESOLUTION preference for complaints/returns:
   - resolution_preference:
     - "refund" if user clearly wants money back
     - "exchange" if user clearly wants a replacement/new piece/size
     - null if unclear or not mentioned
8. Provide a SHORT ISSUE SUMMARY for complaints/returns:
   - short_issue_summary: short neutral sentence describing the problem in the SAME language as the userMessage.
   - If not a complaint/return, use null.
9. Detect YES/NO answers:
   - yes_no_answer:
     - "yes" if the message is essentially a confirmation (yes/yeah/ano/áno/ja/si/etc. – in any language)
     - "no" if the message is essentially a refusal/negative (no/nie/nein/etc.)
     - null if the message is not a pure yes/no answer.

Return a SINGLE JSON object with EXACTLY this shape:

{
  "language_code": "sk",
  "intent": "complaint",
  "is_claim_intent": true,
  "is_shipping_question": false,
  "wants_claim_form": false,
  "mentions_order_number": true,
  "order_id": "123456-AB",
  "resolution_preference": "refund",
  "short_issue_summary": "Prišiel mi rozbitý pohár.",
  "yes_no_answer": "yes"
}

Rules:
- ALWAYS answer in pure JSON. Do not include any other text.
- If you are unsure about something, choose null or false.
- language_code must be two lower-case letters if possible (e.g. "sk", "en", "de", "cs").
`;

export async function POST(req) {
  try {
    const body = await req.json();
    const { userMessage, browserLanguage, previousLanguage } = body || {};

    if (!userMessage || typeof userMessage !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing userMessage" },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify({
            userMessage,
            browserLanguage: browserLanguage || null,
            previousLanguage: previousLanguage || null,
          }),
        },
      ],
    });

    const raw = completion?.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("❌ Intent JSON parse error:", e, raw);
      parsed = null;
    }

    const fallbackLang =
      (previousLanguage && previousLanguage.toLowerCase().slice(0, 2)) ||
      (browserLanguage &&
        browserLanguage.toLowerCase().split(/[-_]/)[0]) ||
      "en";

    const result = {
      language_code:
        parsed?.language_code?.toLowerCase()?.slice(0, 2) || fallbackLang,
      intent: parsed?.intent || "other",
      is_claim_intent: Boolean(parsed?.is_claim_intent),
      is_shipping_question: Boolean(parsed?.is_shipping_question),
      wants_claim_form: Boolean(parsed?.wants_claim_form),
      mentions_order_number: Boolean(parsed?.mentions_order_number),
      order_id:
        typeof parsed?.order_id === "string" && parsed.order_id.trim().length
          ? parsed.order_id.trim()
          : null,
      resolution_preference:
        parsed?.resolution_preference === "refund" ||
        parsed?.resolution_preference === "exchange"
          ? parsed.resolution_preference
          : null,
      short_issue_summary:
        typeof parsed?.short_issue_summary === "string" &&
        parsed.short_issue_summary.trim().length
          ? parsed.short_issue_summary.trim()
          : null,
      yes_no_answer:
        parsed?.yes_no_answer === "yes" || parsed?.yes_no_answer === "no"
          ? parsed.yes_no_answer
          : null,
    };

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("❌ /api/intent error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}

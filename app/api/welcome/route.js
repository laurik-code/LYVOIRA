// app/api/welcome/route.js
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function langFromBrowser(browserLanguage) {
  if (!browserLanguage) return "en";
  return browserLanguage.toLowerCase().split(/[-_]/)[0] || "en";
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { browserLanguage } = body || {};
    const languageCode = langFromBrowser(browserLanguage);

    // 🔹 Špeciálny prípad – slovenčina = presná veta, ktorú chceš
    if (languageCode === "sk") {
      const reply =
        "Ahoj! Som Lyvoira AI poradca 💜 Ako ti môžem pomôcť?";
      return NextResponse.json({
        success: true,
        reply,
        language_code: languageCode,
      });
    }

    // 🔹 Ostatné jazyky – AI preklad / adaptácia tej istej vety
    const systemPrompt = `
You are "Lyvoira", an omnilingual AI assistant for an online shop.

Task:
- Translate and naturally adapt the following Slovak greeting into the target language:
  "Ahoj! Som Lyvoira AI poradca. Ako ti môžem pomôcť?"
- The result MUST be in the language specified by "language_code".
- Keep the meaning:
  - introduce yourself as Lyvoira, an AI assistant for this online shop
  - say you can help with questions / problems (orders, delivery, returns, claims, etc.)
- Style:
  - friendly but professional
  - 1–2 short sentences
  - NO markdown, NO emojis, plain text only.
`.trim();

    const userPrompt = `
language_code: ${languageCode}

Write the greeting now.
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 120,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Hello! I am Lyvoira, the AI assistant for this online shop. How can I help you?";

    return NextResponse.json({
      success: true,
      reply,
      language_code: languageCode,
    });
  } catch (err) {
    console.error("[/api/welcome] ❌", err);
    // fallback – aspoň niečo
    return NextResponse.json(
      {
        success: true,
        reply:
          "Hello! I am Lyvoira, the AI assistant for this online shop. How can I help you?",
        language_code: "en",
      },
      { status: 200 }
    );
  }
}

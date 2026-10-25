import { NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function jsonOk(payload) {
  // vždy 200, aby sa frontend nezosypal
  return NextResponse.json(payload, { status: 200 });
}

function normLang(lang) {
  const l = (lang || "sk").toLowerCase().split(/[-_]/)[0];
  if (l === "sk" || l === "cs" || l === "en") return l;
  return "sk";
}

function t(lang, sk, en, cs) {
  if (lang === "en") return en ?? sk;
  if (lang === "cs") return cs ?? sk;
  return sk;
}

function buildSystemPrompt(lang) {
  const langRule =
    lang === "sk"
      ? "Odpovedaj výhradne po slovensky. Nepíš po anglicky."
      : lang === "cs"
      ? "Odpovídej výhradně česky. Nepiš anglicky."
      : "Answer strictly in English. Do not mix languages.";

  return `
Si AI kontrolór dôkazovej fotografie/video pre reklamáciu v e-shope.
${langRule}

Tvoj výstup MUSÍ byť presne v tomto formáte (4 riadky), nič viac:

1) ...
2) ...
3) ...
4) ...

Pravidlá:
- 1) stručne popíš čo na fotke reálne vidíš (napr. rozbitý pohár, prasklina, odštiepený okraj, balenie, štítok...)
- 2) jasne povedz, či poškodenie VIDÍŠ alebo NEVIDÍŠ
- 3) povedz, či je fotka vhodná ako dôkaz. Ak nie je, povedz PREČO a čo má zákazník spraviť (napr. detail praskliny, viac svetla, foto z viacerých uhlov, foto balenia, foto štítku)
- 4) uveď odporúčaný ďalší krok (čo ešte doplniť / akú fotku poslať), stručne
- Nikdy si nevymýšľaj detaily, ktoré na fotke nie sú zjavné.
- Nepíš žiadne právne texty ani obchodné podmienky, iba posudok fotky.
- NIKDY nespomínaj „rozpor“ ani „mismatch“.
`.trim();
}

function buildFallback(lang) {
  return [
    t(
      lang,
      "1) Na fotke neviem spoľahlivo rozoznať detaily produktu.",
      "1) I can’t reliably identify the product details in the image.",
      "1) Na fotce nedokážu spolehlivě rozpoznat detaily produktu."
    ),
    t(
      lang,
      "2) Poškodenie neviem potvrdiť z tejto fotky.",
      "2) I can’t confirm damage from this image.",
      "2) Poškození z této fotky neumím potvrdit."
    ),
    t(
      lang,
      "3) Táto fotka nie je ideálna ako dôkaz – pošli prosím detail poškodenia (zbližka), viac svetla a 1 fotku celého produktu.",
      "3) This photo isn’t ideal as evidence—please send a close-up of the damage, better lighting, and one full-product photo.",
      "3) Tato fotka není ideální jako důkaz—pošli prosím detail poškození (zblízka), lepší světlo a 1 fotku celého produktu."
    ),
    t(
      lang,
      "4) Odporúčanie: pošli detail poškodenia + celkový záber produktu (z viacerých uhlov).",
      "4) Recommendation: send a close-up of the damage + a full-item shot (from multiple angles).",
      "4) Doporučení: pošli detail poškození + celkový záběr produktu (z více úhlů)."
    ),
  ].join("\n");
}

function normalizeTo4Lines(text, lang) {
  const lines = (text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const picked = [];
  for (const l of lines) {
    if (/^(1|2|3|4)\)/.test(l)) picked.push(l);
    if (picked.length === 4) break;
  }

  const hasAll =
    picked.some((l) => /^1\)/.test(l)) &&
    picked.some((l) => /^2\)/.test(l)) &&
    picked.some((l) => /^3\)/.test(l)) &&
    picked.some((l) => /^4\)/.test(l));

  if (!hasAll || picked.length !== 4) return buildFallback(lang);
  return picked.join("\n");
}

// ✅ vyhodnotenie "photo_ok" z 4-bodového textu (bez mismatch/rozporu)
function parseBooleansFromAssessment(analysis) {
  const a = String(analysis || "").toLowerCase();

  let photo_ok = null;

  const seesDamage =
    a.includes("poškodenie vidíš") ||
    a.includes("poskodenie vidis") ||
    a.includes("poškození vidíš") ||
    a.includes("poskozeni vidis") ||
    a.includes("i see the damage") ||
    a.includes("i can see the damage") ||
    a.includes("damage is visible");

  const doesNotSeeDamage =
    a.includes("poškodenie nevidíš") ||
    a.includes("poskodenie nevidis") ||
    a.includes("poškození nevidíš") ||
    a.includes("poskozeni nevidis") ||
    a.includes("i do not see") ||
    a.includes("i don't see") ||
    a.includes("cannot see the damage");

  const saysSuitable =
    a.includes("vhodná ako dôkaz") ||
    a.includes("vhodna ako dokaz") ||
    a.includes("vhodná jako důkaz") ||
    a.includes("vhodna jako dukaz") ||
    a.includes("suitable as evidence") ||
    a.includes("good evidence");

  const saysNotSuitable =
    a.includes("nie je vhodná") ||
    a.includes("nie je vhodna") ||
    a.includes("není vhodná") ||
    a.includes("neni vhodna") ||
    a.includes("is not suitable") ||
    a.includes("isn't suitable") ||
    a.includes("not ideal as evidence");

  if (doesNotSeeDamage || saysNotSuitable) photo_ok = false;
  if (seesDamage || saysSuitable) photo_ok = true;
  if (doesNotSeeDamage && seesDamage) photo_ok = false;

  return {
    photo_ok: photo_ok === true ? true : false,
  };
}

// ─────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────
export async function POST(req) {
  let body = {};
  try {
    // ✅ JSON čítame IBA RAZ
    body = await req.json();
  } catch {
    body = {};
  }

  const lang = normLang(body?.language);

  try {
    const problemDescription = (body?.problemDescription || "").toString().trim();
    const productName = (body?.productName || "").toString().trim();

    // ✅ podporíme oba názvy (frontend posiela imageUrl aj image_url)
    const imageUrl = (body?.imageUrl || body?.image_url || "").toString().trim();

    if (!imageUrl) {
      const analysis = t(
        lang,
        "1) Neprišla žiadna fotka alebo video.\n2) Poškodenie neviem posúdiť.\n3) Pošli prosím fotku/video, kde je problém jasne vidieť (detail + celok).\n4) Odporúčanie: pošli detail poškodenia + celkový záber produktu.",
        "1) No image/video was provided.\n2) I can’t assess damage.\n3) Please send an image/video showing the issue clearly (close-up + full item).\n4) Recommendation: send a close-up + full item shot.",
        "1) Nepřišla žádná fotka nebo video.\n2) Poškození neumím posoudit.\n3) Pošli prosím fotku/video, kde je problém jasně vidět (detail + celek).\n4) Doporučení: pošli detail poškození + celkový záběr produktu."
      );

      const flags = parseBooleansFromAssessment(analysis);

      return jsonOk({
        success: true,
        analysis,
        photo_ok: flags.photo_ok,
      });
    }

    if (!OPENAI_API_KEY) {
      const analysis = buildFallback(lang);
      const flags = parseBooleansFromAssessment(analysis);

      return jsonOk({
        success: true,
        analysis,
        photo_ok: flags.photo_ok,
      });
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const userText = t(
      lang,
      `Popis zákazníka: ${problemDescription || "(neuvedené)"}\nProdukt (ak je známy): ${productName || "(neuvedené)"}\nÚloha: urob 4-bodový posudok fotky podľa pravidiel.`,
      `Customer description: ${problemDescription || "(not provided)"}\nProduct (if known): ${productName || "(not provided)"}\nTask: produce the 4-line assessment exactly as required.`,
      `Popis zákazníka: ${problemDescription || "(neuvedené)"}\nProdukt (ak je známy): ${productName || "(neuvedené)"}\nÚloha: urob 4-bodový posudok fotky podľa pravidiel.`
    );

    const resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        { role: "system", content: buildSystemPrompt(lang) },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const raw = (resp?.choices?.[0]?.message?.content || "").trim();
    const analysis = normalizeTo4Lines(raw, lang);

    const flags = parseBooleansFromAssessment(analysis);

    return jsonOk({
      success: true,
      analysis,
      photo_ok: flags.photo_ok,
    });
  } catch (e) {
    console.error("[/api/troubleshoot] error:", e);
    const analysis = buildFallback(lang);
    const flags = parseBooleansFromAssessment(analysis);

    return jsonOk({
      success: true,
      analysis,
      photo_ok: flags.photo_ok,
    });
  }
}

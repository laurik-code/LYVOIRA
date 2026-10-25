// /lyvoira_app/app/chat/page.js
// Tier: Basic ✅ (Chat UI)
// Tier: Pro / Enterprise ✅ (Claim prefill + flow do /claims + tracking prefill)
// Pozn.: Nič nemažeme, iba dopĺňame logiku (nevolať /api/chat keď už máme všetko)

"use client";

import { useEffect, useRef, useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// ✅ Podpora – email podpory / reklamácií z env (fallback)
const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SHOP_SUPPORT_EMAIL || "reklamacie@lyvoira.com";

// ✅ Helper na conversation id
function genConversationId() {
  return "c_" + Math.random().toString(36).slice(2, 10);
}

// ✅ Bezpečný localStorage (SSR-safe)
const safeLocal = {
  get(key) {
    try {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, val) {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, val);
    } catch {}
  },
};

// Prekladova helper funkcia
const translate = (language) => (sk, en) => (language === "sk" ? sk : en);

// ✅ spoľahlivá detekcia jazyka z browseru (Google/browser language)
function getBrowserLangCode() {
  try {
    if (typeof navigator === "undefined") return "en";
    const lang =
      navigator.language ||
      (Array.isArray(navigator.languages) && navigator.languages[0]) ||
      "en";
    const code = String(lang).toLowerCase().split(/[-_]/)[0];
    return code === "sk" ? "sk" : "en";
  } catch {
    return "en";
  }
}

// ─────────────────────────────────────────────
// Heuristiky – reklamácie, objednávka, preferencia
// ─────────────────────────────────────────────

const CLAIM_KEYWORDS = [
  "reklamáci",
  "reklamac",
  "reklamovat",
  "reklamovať",
  "vrátit tovar",
  "vrátiť tovar",
  "vratenie tovaru",
  "vrátenie tovaru",
  "claim",
  "complaint",
  "refund",
  "warranty",
  "damaged",
  "broken",
  "rozbit",
  "poškoden",
  "poskoden",
];

function looksLikeClaimIntent(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return CLAIM_KEYWORDS.some((kw) => t.includes(kw));
}

/**
 * Nájdi číslo objednávky – berieme:
 * - buď dlhšie číslo (6+ číslic)
 * - alebo token s číslicami + písmenami (74.jFDJTD.HDTDD…)
 */
function detectOrderIdFromMessage(text) {
  if (!text) return null;
  const trimmed = text.trim();

  // 1) čisté dlhšie číslo
  const longNumber = trimmed.match(/\b\d{6,}\b/);
  if (longNumber) return longNumber[0];

  // 2) tokeny s číslami
  const tokens = trimmed.split(/\s+/);
  for (let rawTok of tokens) {
    let tok = rawTok.trim();
    if (!tok) continue;

    tok = tok.replace(/^[^0-9A-Za-z]+/, "").replace(/[^0-9A-Za-z]+$/, "");
    if (!tok) continue;

    if (!/[0-9]/.test(tok)) continue;

    const coreLen = tok.replace(/[._:-]/g, "").length;
    if (coreLen < 5) continue;

    return tok;
  }

  return null;
}

/**
 * Zistí, či zákazník chce skôr vrátenie peňazí alebo výmenu.
 * Vracia: "refund" | "exchange" | null
 */
function detectResolutionPreference(text) {
  if (!text) return null;

  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // ✅ Rozšírené: stačí aj "vratenie" / "vratenie penazi" / "peniaze spat"
  if (
    /vratit\s*peniaze|vratenie|vratenie\s*penazi|peniaze\s*spat|refund|money\s*back|return\s*money/.test(
      t
    )
  ) {
    return "refund";
  }

  // ✅ výmena
  if (
    /vymenit|vymena|vymenu|vymeni(t|ť)|vyme(n|ň)a|vyme(n|ň)u|vymen(a|u)|novy\s*kus|exchange|replace|replacement/.test(
      t
    )
  ) {
    return "exchange";
  }

  return null;
}

/**
 * Nájde názov/časť produktu z textu (napr. "pohár s mačkami").
 */
function extractProduct(text) {
  if (!text) return null;
  const url = text.match(/https?:\/\/[^\s)]+/i);
  if (url) return url[0];

  const m =
    text.match(/(produkt|tovar)\s*[:\-]?\s*([^\n,.;!?]{3,80})/i) ||
    text.match(/(product|item)\s*[:\-]?\s*([^\n,.;!?]{3,80})/i);
  if (m && m[2]) return m[2].trim();
  return null;
}

// ✅ heuristika či AI povedala, že fotka je ok
function isPhotoOkFromText(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    t.includes("vhodná ako dôkaz") ||
    t.includes("vhodna ako dokaz") ||
    t.includes("photo is suitable") ||
    t.includes("suitable as evidence") ||
    t.includes("i see the damage") ||
    t.includes("vidim") ||
    t.includes("poškodenie vidím") ||
    t.includes("poskodenie vidim")
  );
}

// ✅ zredukuj dlhé 1)2)3) odpovede na krátku vetu (nechávame)
function compactPhotoAssessment(raw, language) {
  const isSk = (language || "sk") === "sk";
  const ok = isPhotoOkFromText(raw);

  if (ok) {
    return isSk
      ? "✅ Fotka vyzerá ako dobrý dôkaz poškodenia."
      : "✅ The photo looks like good evidence of the damage.";
  }

  return isSk
    ? "⚠️ Z tejto fotky to neviem posúdiť spoľahlivo. Skús prosím poslať ostrejšiu fotku pri dobrom svetle (detail poškodenia + celkový záber)."
    : "⚠️ I can’t assess this photo reliably. Please send a sharper photo in good light (close-up of damage + full item shot).";
}

function ChatWidgetContent() {
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);

  // ✅ už žiadny “default” jazyk podľa stavu – nastaví sa hneď z browseru
  const [language, setLanguage] = useState(() => getBrowserLangCode());
  const [browserLanguage, setBrowserLanguage] = useState(null);

  const [userId, setUserId] = useState("");
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // Reklamačný mód & kontext
  const [claimMode, setClaimMode] = useState("inactive"); // "inactive" | "asking"
  const [claimDraft, setClaimDraft] = useState({
    product_id: "",
    order_id: "",
  });

  // ✅ checklist len raz (REF je bezpečný aj keď zavoláš 2x v tom istom ticku)
  const hasShownChecklistRef = useRef(false);
  const [hasShownChecklist, setHasShownChecklist] = useState(false);

  const lastIssueRef = useRef("");
  const lastAiAssessmentRef = useRef("");
  const lastOrderIdRef = useRef("");
  const lastResolutionPrefRef = useRef("");

  const scrollRef = useRef(null);

  const t = translate(language);

  // 1️⃣ Browser language
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const lang =
        navigator.language ||
        (Array.isArray(navigator.languages) && navigator.languages[0]) ||
        null;
      if (lang) {
        setBrowserLanguage(lang);
        const code = String(lang).toLowerCase().split(/[-_]/)[0];
        setLanguage(code === "sk" ? "sk" : "en");
      } else {
        const code = getBrowserLangCode();
        setLanguage(code);
      }
    }
  }, []);

  // 2️⃣ Inicializácia userId, conversationId a načítanie histórie + uvítanie
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      let uid = safeLocal.get("lyvoira_user_id");
      if (!uid) {
        uid = "user_" + Math.random().toString(36).substring(2, 9);
        safeLocal.set("lyvoira_user_id", uid);
      }
      if (cancelled) return;
      setUserId(uid);

      const cidFromUrl = searchParams?.get("cid");
      const cid = cidFromUrl || genConversationId();
      if (cancelled) return;
      setConversationId(cid);

      // ✅ ULOŽ poslednú konverzáciu (na prepojenie s claimom do adminu)
      safeLocal.set("lyvoira_last_conversation_id", cid);

      const langCode = getBrowserLangCode();
      setLanguage(langCode);

      try {
        const url = `/api/messages?user_id=${encodeURIComponent(
          uid
        )}&conversation_id=${encodeURIComponent(cid)}`;
        const res = await fetch(url);
        let loaded = [];
        if (res.ok) {
          const json = await res.json();
          if (json?.success && Array.isArray(json.data)) {
            loaded = [...json.data].sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at)
            );
          }
        }

        if (cancelled) return;

        if (loaded.length > 0) {
          setMessages(loaded);
        } else {
          const welcome =
            langCode === "sk"
              ? "Ahoj! Som Lyvoira AI poradca 💜 Ako ti môžem pomôcť?"
              : "Hello! I’m Lyvoira AI assistant 💜 How can I help you?";

          const tempId = "welcome-" + Date.now();
          const welcomeMsg = {
            sender: "ai",
            message: welcome,
            tempId,
            conversation_id: cid,
            created_at: new Date().toISOString(),
          };
          setMessages([welcomeMsg]);

          await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: uid,
              conversation_id: cid,
              language: langCode,
              sender: "ai",
              message: welcome,
              file_url: null,
            }),
          }).catch(() => {});
        }
      } catch (err) {
        console.error("fetch messages error:", err);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 3️⃣ Scroll
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pendingFiles, isThinking]);

  const toastError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 3000);
  };

  const saveMessage = async ({ sender, text = "", fileUrl = null, tempId }) => {
    if (!userId || !conversationId) return null;
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          conversation_id: conversationId,
          language,
          sender,
          message: text,
          file_url: fileUrl,
        }),
      });

      if (!res.ok) {
        console.error("[MESSAGES POST] ❌ Error:", await res.text());
        toastError(t("❌ Nepodarilo sa uložiť správu.", "❌ Failed to save."));
        return null;
      }

      const data = await res.json();
      if (tempId && data?.data?.id) {
        setMessages((prev) =>
          prev.map((m) => (m.tempId === tempId ? { ...data.data } : m))
        );
      }
      return data;
    } catch (e) {
      console.error("[MESSAGES POST] ❌ Error:", e);
      toastError(t("❌ Nepodarilo sa uložiť správu.", "❌ Failed to save."));
      return null;
    }
  };

  // 🟣 checklist (len raz)
  const showChecklistOnce = () => {
    if (hasShownChecklistRef.current) return;
    hasShownChecklistRef.current = true;
    setHasShownChecklist(true);

    const msgSk = `Aby sa reklamácia alebo vrátenie vybavilo čo najrýchlejšie, priprav si prosím:
• číslo objednávky,
• 1–2 fotky alebo krátke video produktu, kde je problém dobre vidieť,
• krátky popis problému a info, či chceš vrátenie peňazí alebo výmenu.`;

    const msgEn = `To handle your claim or return as fast as possible, please prepare:
• your order number,
• 1–2 photos or a short video clearly showing the issue,
• a short description of the problem and whether you prefer a refund or an exchange.`;

    const text = (language || "sk") === "sk" ? msgSk : msgEn;

    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { sender: "ai", message: text, created_at: now, conversation_id: conversationId || "" },
    ]);
    saveMessage({ sender: "ai", text });
  };

  // ✅ máme všetko pre otvorenie /claims
  const haveAllClaimInfo = (msgs = messages) => {
    const issue = (lastIssueRef.current || "").trim();
    const orderId = (lastOrderIdRef.current || "").trim();
    const pref = (lastResolutionPrefRef.current || "").trim();
    const hasImage = Array.isArray(msgs)
      ? msgs.some((m) => m.sender === "user" && m.file_url)
      : false;
    return !!issue && !!orderId && !!pref && hasImage;
  };

  // ✅ jednotná otázka (Áno/Nie)
  const askOpenClaimFormYesNo = async (msgsSnapshot) => {
    const isSk = (language || "sk") === "sk";
    const ask = isSk
      ? "Mám všetko potrebné. Chceš, aby som otvorila reklamačný formulár? (Áno/Nie)"
      : "I have everything needed. Do you want me to open the claim form? (Yes/No)";

    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { sender: "ai", message: ask, created_at: now, conversation_id: conversationId || "" },
    ]);
    saveMessage({ sender: "ai", text: ask });
    setClaimMode("asking");
  };

  // 🔗 Otvorí /claims & uloží prefill do localStorage
  const openClaimPageWithPrefill = () => {
    try {
      const prod = extractProduct(lastIssueRef.current) || "";
      const orderId = claimDraft.order_id || lastOrderIdRef.current || "";

      const attachmentUrls = messages
        .filter((m) => m.sender === "user" && m.file_url)
        .map((m) => m.file_url);

      let aiText = lastAiAssessmentRef.current || "";
      const extra = [];

      if (orderId) {
        extra.push(
          (language || "sk") === "sk"
            ? `Číslo objednávky podľa chatu: ${orderId}`
            : `Order number from chat: ${orderId}`
        );
      }

      if (lastResolutionPrefRef.current === "refund") {
        extra.push(
          (language || "sk") === "sk"
            ? "Zákazník preferuje vrátenie peňazí."
            : "Customer prefers a refund."
        );
      } else if (lastResolutionPrefRef.current === "exchange") {
        extra.push(
          (language || "sk") === "sk"
            ? "Zákazník preferuje výmenu tovaru."
            : "Customer prefers an exchange."
        );
      }

      if (extra.length) {
        aiText = aiText ? aiText + "\n\n" + extra.join("\n") : extra.join("\n");
      }

      const prefill = {
        description: "",
        product_id: prod,
        order_id: orderId,
        preference: lastResolutionPrefRef.current || "",
        attachments: attachmentUrls || [],
        ai_assessment: aiText || "",
        description_required: true,

        // ✅ prepojenie na admin chat
        user_id: userId || "",
        conversation_id: conversationId || safeLocal.get("lyvoira_last_conversation_id") || "",
        language: language || getBrowserLangCode(),
      };

      safeLocal.set("lyvoira_claim_prefill", JSON.stringify(prefill));

      const infoText =
        (language || "sk") === "sk"
          ? "Otváram reklamačný formulár na novej stránke. Ak sa neotvorí automaticky, klikni na odkaz nižšie."
          : "I’m opening the claim form on a new page. If it doesn’t open automatically, click the link below.";

      const linkText =
        (language || "sk") === "sk"
          ? "👉 Otvoriť reklamačný formulár: /claims"
          : "👉 Open claim form: /claims";

      const now = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { sender: "ai", message: infoText, created_at: now, conversation_id: conversationId || "" },
        { sender: "ai", message: linkText, created_at: now, conversation_id: conversationId || "" },
      ]);

      saveMessage({ sender: "ai", text: infoText });
      saveMessage({ sender: "ai", text: linkText });

      if (typeof window !== "undefined") window.open("/claims", "_blank");
    } catch (e) {
      console.warn("failed to set claim prefill:", e);
    }
  };

  const showTyping = () => {
    if (isThinking) return;
    setIsThinking(true);
    const tempId = "typing-" + Date.now();
    setMessages((prev) => [
      ...prev,
      {
        sender: "ai",
        message: "⋯",
        tempId,
        typing: true,
        created_at: new Date().toISOString(),
        conversation_id: conversationId || "",
      },
    ]);
  };

  const hideTypingAndAddAnswer = async (finalText) => {
    const now = new Date().toISOString();
    setMessages((prev) =>
      prev
        .filter((m) => !m.typing)
        .concat({
          sender: "ai",
          message: finalText,
          created_at: now,
          conversation_id: conversationId || "",
        })
    );
    setIsThinking(false);
    await saveMessage({ sender: "ai", text: finalText });
  };

  // Upload súborov (multi)
  const handlePickFiles = async (fileList) => {
    if (!fileList?.length) return;
    const arr = Array.from(fileList);

    for (const f of arr) {
      const id =
        Date.now() + "-" + f.name + "-" + Math.random().toString(36).slice(2, 6);

      setPendingFiles((prev) => [
        ...prev,
        {
          id,
          file: f,
          progress: 0,
          status: "uploading",
          url: null,
          mime: f.type,
        },
      ]);

      await new Promise((resolve) => {
        const fd = new FormData();
        fd.append("files", f);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload", true);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setPendingFiles((prev) =>
              prev.map((p) => (p.id === id ? { ...p, progress: percent } : p))
            );
          }
        };

        xhr.onload = async () => {
          if (xhr.status === 200) {
            try {
              const json = JSON.parse(xhr.responseText);
              if (json.success) {
                const url = json.urls?.[0] || json.url || null;

                setPendingFiles((prev) =>
                  prev.map((p) =>
                    p.id === id ? { ...p, status: "ready", progress: 100, url } : p
                  )
                );

                const msg =
                  (language || "sk") === "sk"
                    ? "✅ Súbor bol pridaný."
                    : "✅ File added.";

                const now = new Date().toISOString();
                const tempId = "file-added-" + Date.now();
                setMessages((prev) => [
                  ...prev,
                  { sender: "ai", message: msg, tempId, created_at: now, conversation_id: conversationId || "" },
                ]);
                await saveMessage({ sender: "ai", text: msg, tempId });
              } else {
                setPendingFiles((prev) =>
                  prev.map((p) => (p.id === id ? { ...p, status: "error" } : p))
                );
                toastError(json.error || t("❌ Upload zlyhal.", "❌ Upload failed."));
              }
            } catch {
              setPendingFiles((prev) =>
                prev.map((p) => (p.id === id ? { ...p, status: "error" } : p))
              );
            }
          } else {
            setPendingFiles((prev) =>
              prev.map((p) => (p.id === id ? { ...p, status: "error" } : p))
            );
          }
          resolve();
        };

        xhr.onerror = () => {
          setPendingFiles((prev) =>
            prev.map((p) => (p.id === id ? { ...p, status: "error" } : p))
          );
          resolve();
        };

        setIsUploading(true);
        xhr.send(fd);
      });

      setIsUploading(false);
    }
  };

  const removePending = (id) =>
    setPendingFiles((prev) => prev.filter((p) => p.id !== id));

  const allUploadsDone = useMemo(
    () => pendingFiles.every((p) => p.status !== "uploading"),
    [pendingFiles]
  );

  // 🔥 Poslanie správy
  const handleSend = async () => {
    const text = input.trim();
    const readyFiles = pendingFiles.filter((p) => p.status === "ready");

    if (!text && readyFiles.length === 0) return;
    if (!allUploadsDone) return;

    if (!userId || !conversationId) {
      toastError(
        t("Chat sa ešte inicializuje. Skús o pár sekúnd.", "Chat is still initializing.")
      );
      return;
    }

    setPendingFiles([]);

    let newMessages = [...messages];

    // 1) Textová správa
    if (text) {
      const now = new Date().toISOString();
      const tempId = "user-" + Date.now();

      const userMsg = {
        sender: "user",
        message: text,
        tempId,
        conversation_id: conversationId,
        created_at: now,
      };

      newMessages = [...newMessages, userMsg];
      setMessages(newMessages);
      setInput("");
      await saveMessage({ sender: "user", text, tempId });

      // heuristiky
      const detectedOrder = detectOrderIdFromMessage(text);
      if (detectedOrder) {
        lastOrderIdRef.current = detectedOrder;
        setClaimDraft((d) => ({ ...d, order_id: detectedOrder }));
      }

      const pref = detectResolutionPreference(text);
      if (pref) lastResolutionPrefRef.current = pref;

      if (looksLikeClaimIntent(text)) {
        if (!lastIssueRef.current) lastIssueRef.current = text;
        showChecklistOnce();
      } else if (!lastIssueRef.current && text.length > 10) {
        lastIssueRef.current = text;
      }

      // ✅ FIX: ak práve týmto textom doplnil order+pref a už máme aj fotku,
      // tak sa NEVOLÁ /api/chat, ale rovno sa opýtame Áno/Nie
      if (
        claimMode === "inactive" &&
        hasShownChecklistRef.current &&
        haveAllClaimInfo(newMessages)
      ) {
        await askOpenClaimFormYesNo(newMessages);
        return;
      }

      const isFormAsk =
        /reklama(č|c)ny\s+formul(a|á)r|daj\s+formul(a|á)r|claim\s+form/i.test(
          text.toLowerCase()
        );

      if (isFormAsk) {
        const missing = [];
        const hasImage = newMessages.some((m) => m.sender === "user" && m.file_url);
        const isSk = (language || "sk") === "sk";

        if (!lastOrderIdRef.current) missing.push(isSk ? "číslo objednávky" : "order number");
        if (!lastResolutionPrefRef.current)
          missing.push(
            isSk ? "či chceš vrátenie peňazí alebo výmenu" : "preference (refund/exchange)"
          );
        if (!hasImage) missing.push(isSk ? "aspoň 1 fotku/video" : "at least 1 photo/video");
        if (!lastIssueRef.current) missing.push(isSk ? "krátky popis problému" : "short issue description");

        if (missing.length === 0) {
          // ✅ tu nepreskakujeme áno/nie, lebo user explicitne chcel formulár
          openClaimPageWithPrefill();
          setClaimMode("inactive");
          return;
        } else {
          const ask = isSk
            ? `Ešte mi chýba: ${missing.join(", ")}.`
            : `I still need: ${missing.join(", ")}.`;
          await hideTypingAndAddAnswer(ask);
          return;
        }
      }

      // claimMode asking (Áno/Nie)
      if (claimMode === "asking") {
        const normalized = text.toLowerCase().trim();
        const isSk = (language || "sk") === "sk";
        const yesWords = isSk ? ["ano", "áno", "hej", "chcem"] : ["yes", "yeah", "yep"];
        const noWords = isSk ? ["nie", "nechcem"] : ["no", "nope"];

        const isYes = yesWords.some((w) => normalized.includes(w));
        const isNo = noWords.some((w) => normalized.includes(w));

        if (isYes) {
          openClaimPageWithPrefill();
          setClaimMode("inactive");
          return;
        }
        if (isNo) {
          setClaimMode("inactive");
          const txt = isSk
            ? "V poriadku. Ak si to rozmyslíš, stačí napísať „daj reklamačný formulár“."
            : "Alright. If you change your mind, just type “open claim form”.";
          await hideTypingAndAddAnswer(txt);
          return;
        }

        const rep = isSk ? "Prosím, odpovedz Áno alebo Nie." : "Please reply Yes or No.";
        await hideTypingAndAddAnswer(rep);
        return;
      }
    }

    // 2) Súbory – uložíme ich do histórie a spustíme troubleshoot
    for (const p of readyFiles) {
      if (!p.url) continue;

      const now = new Date().toISOString();
      const tempId = "file-" + p.id;

      const fileMsg = {
        sender: "user",
        message: p.file?.name || "file",
        file_url: p.url,
        tempId,
        conversation_id: conversationId,
        created_at: now,
      };

      newMessages = [...newMessages, fileMsg];
      setMessages((prev) => [...prev, fileMsg]);

      await saveMessage({
        sender: "user",
        text: p.file?.name || "file",
        fileUrl: p.url,
        tempId,
      });

      // vizuálny "analyzujem fotku"
      showTyping();
      const analyzingText =
        (language || "sk") === "sk"
          ? "Analyzujem fotku…"
          : "Analyzing the photo…";
      await hideTypingAndAddAnswer(analyzingText);

      try {
        showTyping();
        const res = await fetch("/api/troubleshoot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problemDescription: lastIssueRef.current || "",
            productName: "Unknown",
            user_id: userId,
            language,
            imageUrl: p.url,
            supportEmail: SUPPORT_EMAIL,
          }),
        });

        const data = await res.json();
        const replyText = data?.analysis || data?.reply || "";

        // ✅ prioritne berieme boolean z API, fallback heuristika
        const ok = data?.photo_ok === true ? true : isPhotoOkFromText(replyText);

        if (data?.success && replyText) {
          lastAiAssessmentRef.current = replyText;

          // ✅ DO CHATU DAJ CELÝ AI POSUDOK
          await hideTypingAndAddAnswer(replyText);

          // ✅ ak je fotka OK → pýtaj chýbajúce info
          if (ok) {
            const missing = [];
            const isSk = (language || "sk") === "sk";

            if (!lastOrderIdRef.current) missing.push(isSk ? "číslo objednávky" : "order number");
            if (!lastResolutionPrefRef.current)
              missing.push(
                isSk ? "či chceš vrátenie peňazí alebo výmenu" : "whether you want a refund or an exchange"
              );
            if (!lastIssueRef.current) missing.push(isSk ? "krátky popis problému" : "a short description");

            if (missing.length > 0) {
              const ask = isSk
                ? `Aby som otvorila reklamačný formulár, pošli ešte: ${missing.join(", ")}.`
                : `To open the claim form, please send: ${missing.join(", ")}.`;
              await hideTypingAndAddAnswer(ask);
            } else {
              // ✅ ak už máme všetko hneď po fotke, opýtaj sa áno/nie
              if (claimMode === "inactive" && haveAllClaimInfo(newMessages)) {
                await askOpenClaimFormYesNo(newMessages);
                return;
              }
            }
          } else {
            const isSk = (language || "sk") === "sk";
            const msg = isSk
              ? "Pošli prosím ešte lepšiu fotku/video (detail poškodenia + celkový záber). Ak aj tak chceš podať reklamáciu hneď, napíš „daj reklamačný formulár“."
              : "Please send a clearer photo/video (close-up of damage + full item shot). If you still want to submit the claim now, type “open claim form”.";
            await hideTypingAndAddAnswer(msg);
          }
        } else {
          await hideTypingAndAddAnswer(
            t(
              "⚠️ Momentálne neviem presne posúdiť obrázok. Skús mi prosím napísať viac detailov alebo pošli ostrejšiu fotku.",
              "⚠️ I can’t reliably assess this image right now. Please share more details or send a clearer photo."
            )
          );
        }
      } catch (err) {
        console.warn("troubleshoot error:", err);
        await hideTypingAndAddAnswer(
          t(
            "⚠️ Momentálne neviem analyzovať obrázok. Skús mi prosím napísať viac detailov.",
            "⚠️ I can’t analyze the image right now. Please share more details."
          )
        );
      }
    }

    if (!text) return;

    // ✅ FIX: ešte raz – ak už máme všetko, nedávaj /api/chat odpoveď typu „spracujem“
    if (claimMode === "inactive" && hasShownChecklistRef.current && haveAllClaimInfo(newMessages)) {
      await askOpenClaimFormYesNo(newMessages);
      return;
    }

    // 3) Bežná AI odpoveď cez /api/chat
    showTyping();

    try {
      const historyForApi = newMessages.slice(-20).map((m) => {
        const role = m.sender === "user" ? "user" : "assistant";
        let content = m.message || "";
        if (m.file_url) content += ` [attachment: ${m.file_url}]`;
        return { role, content };
      });

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop_id:
            safeLocal.get("lyvoira_shop_id") ||
            "bc4d82ee-6466-4ce8-99ca-841752c024c3",
          history: historyForApi,
          browserLanguage,
        }),
      });

      if (!res.ok) {
        console.error("[/api/chat] ❌", await res.text());
        await hideTypingAndAddAnswer(
          t(
            "Ospravedlňujem sa, ale momentálne neviem odpovedať (chyba AI).",
            "Sorry, I can’t answer right now due to an AI error."
          )
        );
        return;
      }

      const json = await res.json();
      if (!json?.success || !json.reply) {
        await hideTypingAndAddAnswer(
          t("Ospravedlňujem sa, ale momentálne neviem odpovedať.", "Sorry, I’m unable to answer.")
        );
        return;
      }

      await hideTypingAndAddAnswer(json.reply);

      const isClaimIntent = json.intent === "claim" || json.intent === "return";

      if (isClaimIntent) showChecklistOnce();

      if (isClaimIntent && haveAllClaimInfo(newMessages) && claimMode === "inactive") {
        await askOpenClaimFormYesNo(newMessages);
        return;
      }
    } catch (err) {
      console.error("chat error:", err);
      await hideTypingAndAddAnswer(
        t("Ospravedlňujem sa, ale nastala technická chyba.", "Sorry, a technical error occurred.")
      );
    }
  };

  const newConversation = async () => {
    const newId = genConversationId();
    setConversationId(newId);
    safeLocal.set("lyvoira_last_conversation_id", newId);

    setMessages([]);
    setPendingFiles([]);
    setInput("");
    setClaimMode("inactive");
    setClaimDraft({ product_id: "", order_id: "" });
    lastIssueRef.current = "";
    lastAiAssessmentRef.current = "";
    lastOrderIdRef.current = "";
    lastResolutionPrefRef.current = "";
    hasShownChecklistRef.current = false;
    setHasShownChecklist(false);

    const langCode = getBrowserLangCode();
    setLanguage(langCode);

    const welcome =
      langCode === "sk"
        ? "Ahoj! Som Lyvoira AI poradca 💜 Začnime novú konverzáciu – s čím ti môžem pomôcť?"
        : "Hello! I’m Lyvoira AI assistant 💜 Let’s start a new conversation – how can I help you?";

    const now = new Date().toISOString();
    const tempId = "welcome-" + Date.now();
    const msg = {
      sender: "ai",
      message: welcome,
      tempId,
      conversation_id: newId,
      created_at: now,
    };
    setMessages([msg]);
    await saveMessage({ sender: "ai", text: welcome, tempId });
  };

  const detectKind = (url) => {
    const lower = (url || "").toLowerCase();
    const isImg =
      /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/.test(lower) ||
      lower.includes("/api/file/") ||
      lower.includes("m=image") ||
      lower.includes("mime=image") ||
      lower.includes("content-type=image");
    const isVid =
      /\.(mp4|webm|mov|m4v)(\?.*)?$/.test(lower) ||
      lower.includes("m=video") ||
      lower.includes("mime=video") ||
      lower.includes("content-type=video");
    return { isImg, isVid };
  };

  const renderMessageContent = (msg) => {
    if (msg.file_url) {
      const { isImg, isVid } = detectKind(msg.file_url);
      if (isImg) {
        return (
          <img
            src={msg.file_url}
            alt="attachment"
            className="max-w-[220px] rounded-xl shadow-sm ring-1 ring-purple-100 cursor-pointer hover:opacity-90 transition"
            onClick={() => window.open(msg.file_url, "_blank")}
          />
        );
      }
      if (isVid) {
        return (
          <video
            src={msg.file_url}
            controls
            className="max-w-[240px] rounded-xl shadow-sm ring-1 ring-purple-100"
          />
        );
      }
      return (
        <a
          href={msg.file_url}
          target="_blank"
          className="underline break-all text-purple-700 hover:text-purple-900"
        >
          {msg.message || "file"}
        </a>
      );
    }

    if (msg.typing) {
      return (
        <span className="inline-flex items-center gap-1 text-xl leading-none">
          <span className="animate-pulse">•</span>
          <span className="animate-pulse [animation-delay:150ms]">•</span>
          <span className="animate-pulse [animation-delay:300ms]">•</span>
        </span>
      );
    }

    return (
      <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {msg.message}
      </span>
    );
  };

  const shellBase =
    "fixed z-50 bottom-2 left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:right-4 sm:bottom-4 rounded-2xl shadow-2xl overflow-hidden border border-purple-200 bg-gradient-to-b from-purple-50 to-pink-50 flex flex-col";
  const shellSize =
    "w-[94vw] max-w-[94vw] h-[75vh] sm:w-[22rem] sm:h-[500px] md:w-[23rem] md:h-[520px]";
  const headerCls =
    "bg-gradient-to-r from-purple-600 to-pink-500 text-white px-3 sm:px-4 py-3 flex justify-between items-center";
  const footerCls = "p-2 sm:p-3 border-t bg-white";
  const openBtnCls =
    "fixed bottom-4 right-4 sm:bottom-5 sm:right-5 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 sm:p-4 rounded-full shadow-2xl hover:scale-110 transition-transform";

  return (
    <div>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className={openBtnCls}
          aria-label="Open chat"
        >
          💬
        </button>
      )}

      {open && (
        <div className={`${shellBase} ${shellSize}`}>
          <div className={headerCls}>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-wider drop-shadow-sm">
                Lyvoira
              </h1>
              <p className="text-[10px] sm:text-xs opacity-90 italic truncate">
                Your personal AI assistant
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={newConversation}
                className="text-[10px] sm:text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                title={t("Nová konverzácia", "New conversation")}
              >
                ♻️ {t("Nová", "New")}
              </button>

              <button
                onClick={() => setOpen(false)}
                className="hover:bg-white/20 rounded-full px-2 py-1 text-sm sm:text-base"
                title={t("Zavrieť", "Close")}
              >
                ✖
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-700 px-3 py-2 text-xs sm:text-sm text-center border-b">
              {errorMsg}
            </div>
          )}

          <div
            ref={scrollRef}
            className="flex-1 px-3 sm:px-4 py-3 space-y-2 sm:space-y-3 overflow-y-auto"
          >
            {messages.map((msg, i) => (
              <div
                key={msg.id || msg.tempId || i}
                className={`p-2.5 sm:p-3 rounded-2xl max-w-[85%] sm:max-w-[80%] ${
                  msg.sender === "user"
                    ? "ml-auto bg-gradient-to-r from-purple-500 to-pink-500 text-white text-right shadow"
                    : "mr-auto bg-white border border-purple-100 shadow-sm"
                }`}
              >
                <div className="text-sm leading-relaxed break-words [overflow-wrap:anywhere]">
                  {renderMessageContent(msg)}
                </div>
                <div className="text-[9px] sm:text-[10px] opacity-70 mt-1">
                  {msg.created_at ? new Date(msg.created_at).toLocaleString() : ""}
                </div>
              </div>
            ))}
          </div>

          {pendingFiles.length > 0 && (
            <div className="px-3 sm:px-4 pb-1">
              <div className="flex gap-2 sm:gap-3 flex-wrap">
                {pendingFiles.map((p) => {
                  const isImg = p.mime?.startsWith("image/");
                  const isVid = p.mime?.startsWith("video/");
                  return (
                    <div
                      key={p.id}
                      className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl border border-purple-200 bg-white shadow-sm overflow-hidden"
                    >
                      {isImg ? (
                        <img
                          src={URL.createObjectURL(p.file)}
                          alt={p.file?.name || "file"}
                          className="object-cover w-full h-full"
                        />
                      ) : isVid ? (
                        <video
                          src={URL.createObjectURL(p.file)}
                          className="object-cover w-full h-full"
                          muted
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-[10px] text-gray-600 p-1">
                          {p.file?.name || "file"}
                        </div>
                      )}

                      {p.status === "uploading" && (
                        <>
                          <div className="absolute bottom-0 left-0 w-full h-2 bg-black/10">
                            <div
                              className="h-2 bg-gradient-to-r from-purple-500 to-pink-500"
                              style={{ width: `${p.progress}%` }}
                            />
                          </div>
                          <div className="absolute bottom-2 right-2 text-[10px] bg-black/50 text-white px-1 rounded">
                            {p.progress}%
                          </div>
                        </>
                      )}

                      {p.status === "ready" && (
                        <div className="absolute top-1 left-1 bg-green-500 text-white text-[10px] px-1 rounded-md shadow">
                          ✓
                        </div>
                      )}

                      {p.status === "error" && (
                        <div className="absolute top-1 left-1 bg-red-600 text-white text-[10px] px-1 rounded-md shadow">
                          ✕
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => removePending(p.id)}
                        className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded"
                        title={t("Odstrániť", "Remove")}
                      >
                        ✖
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={footerCls}>
            <div className="flex gap-2 items-center">
              <label className="cursor-pointer grid place-items-center w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow hover:opacity-90">
                📎
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handlePickFiles(e.target.files)}
                />
              </label>

              <input
                className="flex-1 border border-purple-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white/90 text-sm"
                placeholder={t("Napíš správu...", "Type a message...")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />

              <button
                onClick={handleSend}
                disabled={isUploading || !allUploadsDone}
                className={`w-10 h-10 rounded-xl grid place-items-center shadow transition-transform ${
                  isUploading || !allUploadsDone
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:scale-105"
                }`}
                title={
                  isUploading || !allUploadsDone
                    ? t("Čakám na nahranie súborov…", "Waiting for uploads…")
                    : t("Odoslať", "Send")
                }
                aria-label="Send message"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default function ChatWidget() {
  return (
    <Suspense fallback={null}>
      <ChatWidgetContent />
    </Suspense>
  );
}
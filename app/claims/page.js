// /lyvoira_app/app/claims/page.js
// Tier: Pro / Enterprise ✅ (Claim + tracking + prepojenie s chatom)

"use client";

import { useEffect, useMemo, useState } from "react";

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

function detectKind(url) {
  const lower = (url || "").toLowerCase();
  const isImg = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/.test(lower);
  const isVid = /\.(mp4|webm|mov|m4v)(\?.*)?$/.test(lower);
  return { isImg, isVid };
}

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

export default function ClaimsPage() {
  const [product, setProduct] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [description, setDescription] = useState("");

  const [preference, setPreference] = useState("");
  const [aiAssessment, setAiAssessment] = useState("");
  const [chatAttachments, setChatAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [submitMsg, setSubmitMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isSending, setIsSending] = useState(false);

  // ✅ NOVÉ: prepojenie na chat/admin
  const [prefillUserId, setPrefillUserId] = useState("");
  const [prefillConversationId, setPrefillConversationId] = useState("");
  const [prefillLanguage, setPrefillLanguage] = useState(() => getBrowserLangCode());

  // ✅ Toast (pevne dole)
  const [toast, setToast] = useState(null); // { type: "ok"|"err", text: string }
  const showToast = (type, text) => {
    setToast({ type, text });
    // auto-hide
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    try {
      const raw = safeLocal.get("lyvoira_claim_prefill");
      if (!raw) {
        // fallback z localStorage aj bez prefillu
        setPrefillUserId(safeLocal.get("lyvoira_user_id") || "");
        setPrefillConversationId(safeLocal.get("lyvoira_last_conversation_id") || "");
        setPrefillLanguage(getBrowserLangCode());
        return;
      }
      const prefill = JSON.parse(raw);

      setProduct(prefill?.product_id || "");
      setOrderId(prefill?.order_id || "");
      setPreference(prefill?.preference || "");
      setAiAssessment(prefill?.ai_assessment || "");
      setChatAttachments(Array.isArray(prefill?.attachments) ? prefill.attachments : []);
      setDescription("");

      // ✅ doplnené
      setPrefillUserId(prefill?.user_id || safeLocal.get("lyvoira_user_id") || "");
      setPrefillConversationId(
        prefill?.conversation_id || safeLocal.get("lyvoira_last_conversation_id") || ""
      );
      setPrefillLanguage(prefill?.language || getBrowserLangCode());
    } catch {
      setPrefillUserId(safeLocal.get("lyvoira_user_id") || "");
      setPrefillConversationId(safeLocal.get("lyvoira_last_conversation_id") || "");
      setPrefillLanguage(getBrowserLangCode());
    }
  }, []);

  const attachmentsCount = useMemo(() => {
    return (chatAttachments?.length || 0) + (newFiles?.length || 0);
  }, [chatAttachments, newFiles]);

  const removeChatAttachment = (url) => {
    setChatAttachments((prev) => prev.filter((u) => u !== url));
  };

  const removeNewFile = (idx) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const onPickFiles = (fileList) => {
    if (!fileList?.length) return;
    setNewFiles((prev) => [...prev, ...Array.from(fileList)]);
  };

  const validate = () => {
    setErrorMsg(null);

    if (!product.trim()) return "Zadajte názov alebo link na produkt.";
    if (!fullName.trim()) return "Zadajte vaše meno a priezvisko.";
    if (!email.trim()) return "Zadajte e-mail.";
    if (!email.includes("@")) return "E-mail nemá správny tvar.";
    if (!orderId.trim()) return "Zadajte číslo objednávky.";
    if (!description.trim())
      return "Popis problému je povinný – napíšte ho vlastnými slovami.";
    if (description.trim().length < 8)
      return "Popis problému je príliš krátky (napíš aspoň pár slov).";
    if (attachmentsCount < 1)
      return "Aspoň jedna fotka alebo video poškodeného tovaru je povinné.";

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setErrorMsg(err);
      showToast("err", err);
      return;
    }

    setIsSending(true);
    setSubmitMsg(null);
    setErrorMsg(null);

    try {
      const fd = new FormData();

      fd.append("website", "");

      fd.append("product_id", product.trim());
      fd.append("user_name", fullName.trim());
      fd.append("user_email", email.trim());
      fd.append("order_id", orderId.trim());
      fd.append("description", description.trim());

      if (preference) fd.append("preference", preference);
      if (aiAssessment) fd.append("ai_assessment", aiAssessment);

      // ✅ NOVÉ: posielame user_id / conversation_id / language
      if (prefillUserId) fd.append("user_id", prefillUserId);
      if (prefillConversationId) fd.append("conversation_id", prefillConversationId);
      if (prefillLanguage) fd.append("language", prefillLanguage);

      // chat attachments (url stringy)
      for (const url of chatAttachments || []) {
        if (url) fd.append("files", url);
      }

      // nové súbory
      for (const f of newFiles || []) {
        if (f) fd.append("files", f);
      }

      const res = await fetch("/api/claim", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.success) {
        const msg = json?.error || "Nepodarilo sa odoslať reklamáciu.";
        setErrorMsg(msg);
        showToast("err", msg);
        setIsSending(false);
        return;
      }

      // ✅ success
      setSubmitMsg("✅ Reklamácia bola odoslaná. Ďakujeme!");
      showToast("ok", "✅ Reklamácia bola úspešne odoslaná. Ďakujeme!");

      setIsSending(false);

      // ✅ reset formu (necháme prefill hodnoty)
      setFullName("");
      setEmail("");
      setDescription("");

      // nové súbory preč
      setNewFiles([]);

      // voliteľné: ak chceš po úspechu vymazať aj chat prílohy, odkomentuj:
      // setChatAttachments([]);

      // voliteľné: ak chceš zrušiť prefill z localStorage aby sa pri ďalšom otvorení nepredvyplnilo:
      // safeLocal.set("lyvoira_claim_prefill", "");
    } catch (e2) {
      const msg = "Nastala technická chyba pri odoslaní.";
      setErrorMsg(msg);
      showToast("err", msg);
      setIsSending(false);
    }
  };

  // ✅ Previews + cleanup object URLs (aby nezožrali pamäť)
  const previews = useMemo(() => {
    return (newFiles || []).map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
      isImg: !!f.type?.startsWith("image/"),
      isVid: !!f.type?.startsWith("video/"),
    }));
  }, [newFiles]);

  useEffect(() => {
    return () => {
      for (const p of previews) {
        try {
          URL.revokeObjectURL(p.url);
        } catch {}
      }
    };
  }, [previews]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 px-4 py-10">
      {/* ✅ TOAST – pevne dole, aby sa nemuselo scrollovať */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[9999] max-w-[92vw]">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border text-sm flex items-start gap-3 ${
              toast.type === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="min-w-0">{toast.text}</div>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border bg-white/60 hover:bg-white"
              onClick={() => setToast(null)}
              title="Zavrieť"
            >
              ✖
            </button>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-purple-100 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-purple-600 to-pink-500 text-white">
          <h1 className="text-xl font-bold">📦 Reklamačný formulár</h1>
          <p className="text-sm opacity-90 mt-1">
            Vyplňte prosím všetky povinné údaje pre spracovanie reklamácie.
            Časť informácií mohla byť predvyplnená z chatu – môžete ju upraviť podľa potreby.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {errorMsg}
            </div>
          )}
          {submitMsg && (
            <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm">
              {submitMsg}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-1">
              Názov alebo link na produkt <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-purple-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="Napr. Keramický pohár s mačkami, odkaz na produkt..."
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Vaše meno <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-purple-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="Meno a priezvisko"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Váš e-mail <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className="w-full border border-purple-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="napr. moje.meno@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Číslo objednávky <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full border border-purple-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="napr. 642427247272"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Popis problému <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full min-h-[120px] border border-purple-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              placeholder="Popíš prosím problém vlastnými slovami (napr. pohár prišiel rozbitý...)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Toto pole sa z chatu automaticky nevyplňuje – prosím napíš ho vlastnými slovami.
            </p>
          </div>

          {preference && (
            <div className="text-sm bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
              {preference === "refund" ? (
                <span>✅ Zákazník preferuje vrátenie peňazí.</span>
              ) : preference === "exchange" ? (
                <span>✅ Zákazník preferuje výmenu tovaru.</span>
              ) : null}
            </div>
          )}

          {aiAssessment && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <div className="font-semibold text-sm mb-1">🤖 AI posudok situácie</div>
              <pre className="text-xs whitespace-pre-wrap break-words">{aiAssessment}</pre>
              <p className="text-[11px] text-gray-500 mt-2">
                Tento text bol vygenerovaný AI podľa vášho popisu a fotiek v chate. Slúži ako pomocná informácia pre obchod.
              </p>
            </div>
          )}

          <div className="bg-white">
            <label className="block text-sm font-semibold mb-2">
              📎 Prílohy (fotky / video sú povinné) <span className="text-red-500">*</span>
            </label>

            {chatAttachments?.length > 0 && (
              <div className="mb-3 space-y-2">
                {chatAttachments.map((url, idx) => {
                  const { isImg, isVid } = detectKind(url);
                  return (
                    <div
                      key={url + idx}
                      className="flex items-center justify-between gap-3 border border-purple-100 rounded-xl p-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isImg ? (
                          <img
                            src={url}
                            alt="chat-attachment"
                            className="w-14 h-14 object-cover rounded-lg border"
                            onClick={() => window.open(url, "_blank")}
                            style={{ cursor: "pointer" }}
                          />
                        ) : isVid ? (
                          <video
                            src={url}
                            className="w-14 h-14 object-cover rounded-lg border"
                            onClick={() => window.open(url, "_blank")}
                            style={{ cursor: "pointer" }}
                          />
                        ) : (
                          <div className="w-14 h-14 grid place-items-center rounded-lg border text-xs">
                            file
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">chat-attachment-{idx + 1}</div>
                          <button
                            type="button"
                            className="text-xs text-purple-700 underline"
                            onClick={() => window.open(url, "_blank")}
                          >
                            otvoriť
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg px-2 py-1"
                        onClick={() => removeChatAttachment(url)}
                      >
                        ✖
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-xl text-sm hover:opacity-90">
                + Priložiť ďalšie súbory
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickFiles(e.target.files)}
                />
              </label>

              <div className="text-xs text-gray-600">
                Aspoň jedna fotka/video je povinné – môže byť z chatu alebo nové
              </div>
            </div>

            {previews.length > 0 && (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {previews.map((p, idx) => (
                  <div key={(p.file?.name || "file") + idx} className="relative border rounded-xl overflow-hidden">
                    {p.isImg ? (
                      <img src={p.url} alt={p.file?.name || "file"} className="w-full h-24 object-cover" />
                    ) : p.isVid ? (
                      <video src={p.url} className="w-full h-24 object-cover" muted />
                    ) : (
                      <div className="w-full h-24 grid place-items-center text-xs">{p.file?.name}</div>
                    )}

                    <button
                      type="button"
                      className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-1 rounded"
                      onClick={() => removeNewFile(idx)}
                    >
                      ✖
                    </button>
                    <div className="p-2 text-[11px] truncate">{p.file?.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSending}
            className={`w-full rounded-xl px-4 py-3 font-semibold text-white ${
              isSending ? "bg-gray-400" : "bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-95"
            }`}
          >
            {isSending ? "Odosielam..." : "Odoslať reklamáciu"}
          </button>
        </form>
      </div>
    </div>
  );
}

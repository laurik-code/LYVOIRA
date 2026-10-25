"use client";

import { useEffect, useState } from "react";

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

export default function ClaimFormPage() {
  const [productId, setProductId] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [description, setDescription] = useState("");
  const [aiAssessment, setAiAssessment] = useState("");
  const [chatAttachments, setChatAttachments] = useState([]); // string[] URLs
  const [extraFiles, setExtraFiles] = useState([]); // File[]
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState(null); // { type: "success"|"error", msg: string }
  const [submitting, setSubmitting] = useState(false);

  // načítanie prefillu z chatu
  useEffect(() => {
    const uid = safeLocal.get("lyvoira_user_id");
    if (uid) setUserId(uid);

    const raw = safeLocal.get("lyvoira_claim_prefill");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.product_id) setProductId(parsed.product_id);
      if (parsed.order_id) setOrderId(parsed.order_id);
      if (parsed.description) setDescription(parsed.description);
      if (parsed.ai_assessment) {
        let aiText = parsed.ai_assessment;

        if (parsed.order_id && !aiText.includes(parsed.order_id)) {
          const extraLine = `Číslo objednávky podľa chatu: ${parsed.order_id}`;
          aiText = aiText ? `${aiText}\n\n${extraLine}` : extraLine;
        }

        setAiAssessment(aiText);
      }
      if (Array.isArray(parsed.attachments)) {
        setChatAttachments(parsed.attachments.filter(Boolean));
      }
    } catch (e) {
      console.warn("Failed to parse claim prefill:", e);
    }
  }, []);

  const handleExtraFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setExtraFiles((prev) => [...prev, ...files]);
  };

  const removeChatAttachment = (url) => {
    setChatAttachments((prev) => prev.filter((u) => u !== url));
  };

  const removeExtraFile = (name) => {
    setExtraFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    if (!productId.trim() || !userName.trim() || !userEmail.trim()) {
      setStatus({
        type: "error",
        msg: "Prosím vyplňte všetky povinné polia (produkt, meno, e-mail).",
      });
      return;
    }
    if (!orderId.trim()) {
      setStatus({
        type: "error",
        msg: "Prosím vyplňte číslo objednávky.",
      });
      return;
    }
    if (!description.trim()) {
      setStatus({
        type: "error",
        msg: "Prosím popíšte problém v príslušnom poli.",
      });
      return;
    }
    if (chatAttachments.length === 0 && extraFiles.length === 0) {
      setStatus({
        type: "error",
        msg: "Je potrebné priložiť aspoň jednu fotku alebo video (z chatu alebo znovu nahranú).",
      });
      return;
    }

    setSubmitting(true);

    try {
      const form = new FormData();
      form.append("product_id", productId);
      form.append("user_name", userName);
      form.append("user_email", userEmail);
      form.append("order_id", orderId);
      form.append("description", description);
      form.append("ai_assessment", aiAssessment || "");
      form.append("user_id", userId || "");

      // honeypot
      form.append("website", "");

      // chat attachments – ako stringové URL
      chatAttachments.forEach((url) => {
        form.append("files", url);
      });

      // extra súbory – reálne File objekty
      extraFiles.forEach((file) => {
        form.append("files", file);
      });

      const res = await fetch("/api/claim", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Claim submit error:", text);
        setStatus({
          type: "error",
          msg: "Odoslanie reklamácie zlyhalo. Skúste to prosím neskôr znova.",
        });
        setSubmitting(false);
        return;
      }

      const json = await res.json();
      if (!json.success) {
        setStatus({
          type: "error",
          msg:
            json.error ||
            "Odoslanie reklamácie zlyhalo. Skúste to prosím neskôr znova.",
        });
        setSubmitting(false);
        return;
      }

      setStatus({
        type: "success",
        msg: "Reklamácia bola úspešne odoslaná. Ozveme sa vám čo najskôr.",
      });

      // vyčistenie formulára, ale necháme ai_assessment pre info
      setProductId("");
      setUserName("");
      setUserEmail("");
      setOrderId("");
      setDescription("");
      setChatAttachments([]);
      setExtraFiles([]);
    } catch (e) {
      console.error("Claim submit exception:", e);
      setStatus({
        type: "error",
        msg: "Nastala neočakávaná chyba pri odosielaní. Skúste to prosím znova.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex justify-center items-start bg-gradient-to-b from-purple-50 to-white px-3 py-6">
      <div className="w-full max-w-xl bg-white/90 rounded-2xl shadow-xl border border-purple-100 p-4 sm:p-6 space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-purple-800 flex items-center gap-2">
            📦 Reklamačný formulár
          </h1>
          <p className="text-xs sm:text-sm text-gray-600">
            Vyplňte prosím všetky povinné údaje pre spracovanie reklamácie.
            Časť informácií mohla byť predvyplnená z chatu Lyvoira – môžete ju
            upraviť podľa potreby.
          </p>
        </header>

        {status && (
          <div
            className={`text-xs sm:text-sm px-3 py-2 rounded-md border ${
              status.type === "success"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            {status.msg}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-3 text-xs sm:text-sm"
        >
          <div className="space-y-1">
            <label className="font-medium text-gray-800">
              Názov alebo link na produkt <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
              placeholder="Napr. Keramický pohár s mačkami, odkaz na produkt..."
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-medium text-gray-800">
                Vaše meno <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                placeholder="Meno a priezvisko"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-gray-800">
                Váš e-mail <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                className="w-full border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                placeholder="napr. moje.meno@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-medium text-gray-800">
              Číslo objednávky <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
              placeholder="napr. 642427247272"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="font-medium text-gray-800">
              Popis problému <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm min-h-[80px]"
              placeholder="Stručne popíšte, čo je s tovarom v neporiadku a aké riešenie preferujete (výmena/vrátenie peňazí)…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {aiAssessment && (
            <div className="space-y-1">
              <label className="font-medium text-gray-800 flex items-center gap-1">
                🤖 AI posudok situácie
              </label>
              <div className="border rounded-lg px-2 py-2 bg-gray-50 text-xs whitespace-pre-wrap">
                {aiAssessment}
              </div>
              <p className="text-[10px] text-gray-500">
                Tento text bol vygenerovaný AI podľa vášho popisu a fotiek v
                chate. Slúži ako pomocná informácia pre obchod.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="font-medium text-gray-800">
              📎 Prílohy z chatu (fotky / video sú povinné)
              <span className="text-red-500"> *</span>
            </label>

            {chatAttachments.length > 0 && (
              <div className="space-y-1">
                {chatAttachments.map((url, idx) => (
                  <div
                    key={url}
                    className="flex items-center justify-between text-xs border rounded-lg px-2 py-1 bg-purple-50/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-purple-700 font-semibold">
                        chat-attachment-{idx + 1}
                      </span>
                      <button
                        type="button"
                        className="underline text-[10px] text-purple-700"
                        onClick={() => window.open(url, "_blank")}
                      >
                        otvoriť
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeChatAttachment(url)}
                      className="text-red-500 text-xs hover:underline"
                    >
                      ✖
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-1">
              <label className="inline-flex items-center gap-2 text-xs text-purple-800 cursor-pointer">
                <span className="px-2 py-1 rounded-lg border border-purple-300 bg-purple-50 hover:bg-purple-100">
                  + Priložiť ďalšie súbory
                </span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleExtraFiles}
                />
              </label>
            </div>

            {extraFiles.length > 0 && (
              <div className="space-y-1 mt-1">
                {extraFiles.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between text-xs border rounded-lg px-2 py-1 bg-gray-50"
                  >
                    <span className="truncate max-w-[70%]">
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeExtraFile(file.name)}
                      className="text-red-500 text-xs hover:underline"
                    >
                      ✖
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-gray-500 mt-1">
              Aspoň jedna fotka alebo video poškodeného tovaru je povinné –
              môže byť z chatu alebo nová príloha.
            </p>
          </div>

          {/* honeypot */}
          <input
            type="text"
            name="website"
            className="hidden"
            autoComplete="off"
            tabIndex={-1}
          />

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className={`w-full inline-flex justify-center items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white shadow-md transition ${
                submitting
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600"
              }`}
            >
              {submitting ? "Odosielam reklamáciu…" : "Odoslať reklamáciu"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

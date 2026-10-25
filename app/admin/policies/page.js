
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AdminPoliciesPage() {
  const [text, setText] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const shopId = process.env.NEXT_PUBLIC_SHOP_ID;

  useEffect(() => {
    async function loadPolicies() {
      if (!shopId) {
        setError("Chýba NEXT_PUBLIC_SHOP_ID v .env.local.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/policies/admin/get", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shop_id: shopId }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Načítanie zlyhalo.");
        }

        setText(data.text || "");
        setOriginal(data.text || "");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadPolicies();
  }, [shopId]);

  async function savePolicies() {
    if (!text.trim() || saving) return;

    if (!window.confirm(
      "Naozaj chceš nahradiť existujúce pravidlá tohto obchodu?"
    )) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/policies/admin/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_id: shopId, text }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Uloženie zlyhalo.");
      }

      setOriginal(text);
      setMessage(
        `Pravidlá uložené. Vytvorených častí: ${data.chunksCount}.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ly-page">
      <div className="ly-shell">
        <div className="ly-glass ly-header animate-fadeIn">
          <div>
            <div className="ly-title">Policies</div>
            <div className="ly-subtitle">
              Správa pravidiel a odpovedí AI asistenta
            </div>
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            <Link href="/admin" className="ly-btn ly-btn-soft">
              Admin
            </Link>
            <Link href="/admin/dashboard" className="ly-btn ly-btn-soft">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-4 ly-card p-6">
          <div className="ly-h2">Pravidlá e-shopu</div>

          <p className="text-sm ly-muted mt-2">
            Pravidlá sa načítavajú zo Supabase podľa shop_id.
          </p>

          {loading ? (
            <p className="mt-5">Načítavam pravidlá...</p>
          ) : (
            <>
              <textarea
                className="w-full mt-5 p-4 rounded-xl border bg-transparent"
                rows={18}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={!!error && !original && !text}
                placeholder="Zatiaľ nie sú uložené žiadne pravidlá."
                style={{ resize: "vertical" }}
              />

              {error && (
                <p className="mt-3 text-red-500">{error}</p>
              )}

              {message && (
                <p className="mt-3 text-green-500">{message}</p>
              )}

              <div className="flex gap-3 mt-5 items-center flex-wrap">
                <button
                  type="button"
                  className="ly-btn ly-btn-soft"
                  onClick={savePolicies}
                  disabled={
                    saving ||
                    !!error ||
                    !shopId ||
                    !text.trim() ||
                    text === original
                  }
                >
                  {saving ? "Ukladám..." : "Uložiť pravidlá"}
                </button>

                <span className="text-sm ly-muted">
                  {text !== original
                    ? "Neuložené zmeny"
                    : "Bez neuložených zmien"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

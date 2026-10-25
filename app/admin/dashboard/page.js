// /lyvoira_app/app/admin/dashboard/page.js
// Tier: Pro/Enterprise ✅
// Purpose: Admin dashboard (ALL TIME analytics)

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function formatDateSK(dateStr) {
  try {
    if (!dateStr) return "—";
    const d = new Date(dateStr.includes(" ") ? dateStr.replace(" ", "T") : dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}-${mm}-${yy}`;
  } catch {
    return "—";
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openDay, setOpenDay] = useState(null);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const i = setInterval(fetchStats, 2 * 60 * 1000);
    return () => clearInterval(i);
  }, []);

  const total = stats?.total ?? 0;
  const by_language = stats?.by_language && typeof stats.by_language === "object" ? stats.by_language : {};
  const top_products_all = Array.isArray(stats?.top_products_all) ? stats.top_products_all : [];
  const days_all = Array.isArray(stats?.days_all) ? stats.days_all : [];

  const dayMax = useMemo(() => {
    const vals = days_all.map((d) => d.cnt || 0);
    return Math.max(1, ...vals);
  }, [days_all]);

  if (loading) {
    return (
      <div className="ly-page">
        <div className="ly-shell">
          <div className="ly-card p-6">Načítavam…</div>
        </div>
      </div>
    );
  }

  if (!stats || stats.error) {
    return (
      <div className="ly-page">
        <div className="ly-shell">
          <div className="ly-card p-6" style={{ borderColor: "rgba(239,68,68,0.35)" }}>
            Chyba pri načítaní štatistík.
          </div>
        </div>
      </div>
    );
  }

  const DayModal = () => {
    if (!openDay) return null;

    return (
      <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-3">
        <div className="ly-card-strong w-[820px] max-w-[98vw] rounded-[22px] overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b bg-white/70" style={{ borderColor: "var(--ly-border)" }}>
            <div>
              <div className="font-semibold text-[15px]">Deň: {openDay.date}</div>
              <div className="text-[12px] ly-muted">Reklamácie: {openDay.cnt}</div>
            </div>
            <button className="ly-btn ly-btn-soft py-2" onClick={() => setOpenDay(null)}>
              Zavrieť
            </button>
          </div>

          <div className="p-5">
            <div className="text-sm ly-muted mb-3">Príklady (max. 3)</div>

            <div className="space-y-2">
              {(openDay.examples || []).map((ex) => (
                <div key={ex.id} className="ly-card p-4">
                  <div className="text-xs ly-muted mb-1">Produkt</div>
                  <div className="font-semibold break-words">{ex.product_id}</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    <div>
                      <div className="text-xs ly-muted">Meno</div>
                      <div className="text-sm break-words">{ex.user_name}</div>
                    </div>
                    <div>
                      <div className="text-xs ly-muted">Email</div>
                      <div className="text-sm break-words">{ex.user_email}</div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs ly-muted">Claim ID: {ex.id}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Link href="/admin" className="ly-btn ly-btn-soft">
                Otvoriť admin
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="ly-page">
      {openDay && <DayModal />}

      <div className="ly-shell">
        <div className="ly-glass ly-header animate-fadeIn">
          <div>
            <div className="ly-title">Dashboard</div>
            <div className="ly-subtitle">All-time prehľad</div>
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            <Link href="/admin" className="ly-btn ly-btn-soft">Admin</Link>
            <Link href="/admin/dashboard" className="ly-btn ly-btn-soft">Dashboard</Link>
            <Link href="/admin/policies" className="ly-btn ly-btn-soft">Policies</Link>
            <button onClick={fetchStats} className="ly-btn ly-btn-soft">Refresh</button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="ly-card p-5">
            <div className="text-xs ly-muted">Total claims</div>
            <div className="text-3xl font-semibold mt-2">{total}</div>
          </div>

          <div className="ly-card p-5">
            <div className="text-xs ly-muted">Languages</div>
            <div className="mt-3 space-y-1 max-h-[170px] overflow-y-auto pr-1">
              {Object.keys(by_language).length === 0 ? (
                <div className="text-sm ly-muted">—</div>
              ) : (
                Object.entries(by_language).map(([lang, cnt]) => (
                  <div key={lang} className="flex justify-between text-sm">
                    <span className="font-medium">{lang}</span>
                    <span className="text-[13px] ly-muted">{cnt}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="ly-card p-5">
            <div className="text-xs ly-muted">Top products (all time)</div>
            <div className="mt-3 space-y-1 max-h-[170px] overflow-y-auto pr-1">
              {top_products_all.length === 0 ? (
                <div className="text-sm ly-muted">—</div>
              ) : (
                top_products_all.map((p, idx) => (
                  <div key={p.key + idx} className="flex justify-between gap-3 text-sm">
                    <span className="truncate max-w-[220px]" title={p.product_id}>
                      {p.product_id}
                    </span>
                    <span className="font-semibold">{p.cnt}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 ly-card p-5">
          <div className="ly-h2 mb-3">Claims timeline (all time)</div>

          {days_all.length === 0 ? (
            <div className="text-sm ly-muted">Zatiaľ žiadne dáta.</div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto pr-2">
              <div className="flex flex-wrap gap-2">
                {days_all.map((d) => {
                  const size = 14 + Math.round((Math.min(d.cnt, dayMax) / dayMax) * 22);
                  const niceDate = formatDateSK(d.date);
                  const tip = `${niceDate} • ${d.cnt}`;

                  return (
                    <button
                      key={d.date}
                      title={tip}
                      onClick={() => setOpenDay({ ...d, date: niceDate })}
                      className="rounded-[10px] border shadow-sm hover:opacity-95"
                      style={{
                        width: size,
                        height: size,
                        borderColor: "rgba(15,23,42,0.12)",
                        background:
                          "linear-gradient(145deg, rgba(124,58,237,0.12), rgba(236,72,153,0.10), rgba(56,189,248,0.08))",
                      }}
                    />
                  );
                })}
              </div>

              <div className="text-xs ly-muted mt-3">
                Hover = info, klik = detaily dňa.
              </div>
            </div>
          )}
        </div>

        <div className="h-10" />
      </div>
    </div>
  );
}

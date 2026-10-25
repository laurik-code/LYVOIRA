// /lyvoira_app/app/admin/page.js
// Tier: Pro, Enterprise ✅
// Purpose: Admin panel (reklamácie + chaty + prílohy)

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

function isUuid(v) {
  if (!v) return false;
  const s = String(v).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

function toDateSafe(raw) {
  try {
    if (!raw) return null;
    const s = String(raw).trim();
    const isoLike = s.includes(" ") ? s.replace(" ", "T") : s;
    const d = new Date(isoLike);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  } catch {
    return null;
  }
}

function formatDateSK(dateStr) {
  const d = toDateSafe(dateStr);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

function formatDateTimeSK(dateStr) {
  const d = toDateSafe(dateStr);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yy} ${hh}:${mi}`;
}

function detectKind(url) {
  const lower = (url || "").toLowerCase();

  const isImg =
    /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/.test(lower) ||
    lower.includes("m=image") ||
    lower.includes("mime=image") ||
    lower.includes("content-type=image");

  const isVid =
    /\.(mp4|webm|mov|m4v)(\?.*)?$/.test(lower) ||
    lower.includes("m=video") ||
    lower.includes("mime=video") ||
    lower.includes("content-type=video");

  return { isImg, isVid };
}

function normalizeAttachments(raw) {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => {
      if (!a) return null;
      if (typeof a === "string") return { url: a, mime: "", name: "", source: "unknown" };
      if (typeof a === "object") {
        return { url: a.url || "", mime: a.mime || "", name: a.name || "", source: a.source || "" };
      }
      return null;
    })
    .filter((x) => x && x.url);
}

function labelOrDash(v) {
  const s = (v ?? "").toString().trim();
  return s ? s : "—";
}

export default function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [tab, setTab] = useState("claims"); // "claims" | "messages"
  const [loading, setLoading] = useState(false);

  const [claims, setClaims] = useState([]);
  const [claimPhotos, setClaimPhotos] = useState({});

  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatPhotos, setChatPhotos] = useState({});
  const [conversations, setConversations] = useState([]);

  const [shopIdInput, setShopIdInput] = useState("");
  const [shopIdApplied, setShopIdApplied] = useState("");
  const [filter, setFilter] = useState("");

  const [page, setPage] = useState(1);
  const perPage = 10;
  const chatRef = useRef(null);

  const [openClaim, setOpenClaim] = useState(null);
  const [claimModalFull, setClaimModalFull] = useState(false);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem("lyvoira_shop_id") || "";
      if (v && !isUuid(v)) {
        window.localStorage.setItem("lyvoira_shop_id", "");
        setShopIdInput("");
        setShopIdApplied("");
      } else {
        setShopIdInput(v);
        setShopIdApplied(v);
      }
    } catch {}
  }, []);

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuthed(true);
        setPassword("");
        setShowPass(false);
        setFilter("");
        setPage(1);
        fetchClaims(shopIdApplied);
        fetchAllChats();
      } else {
        alert("Nesprávne heslo");
      }
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin-logout", { method: "POST" });
    setAuthed(false);
    setClaims([]);
    setMessages([]);
    setConversations([]);
    setSelectedUser(null);
    setFilter("");
    setPage(1);
    setOpenClaim(null);
  };

  useEffect(() => {
    if (!authed) return;
    const onBeforeUnload = () => {
      try {
        fetch("/api/admin-logout", { method: "POST", keepalive: true }).catch(() => {});
      } catch {}
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [authed]);

  const fetchClaims = async (shopId) => {
    setLoading(true);
    try {
      const cleanShop = isUuid(shopId) ? shopId : "";
      const qs = cleanShop ? `?shop_id=${encodeURIComponent(cleanShop)}` : "";
      const res = await fetch(`/api/admin-claims${qs}`);
      if (!res.ok) throw new Error("Unauthorized");

      const list = (await res.json()) || [];
      list.sort((a, b) => {
        const da = toDateSafe(a.created_at)?.getTime() || 0;
        const db = toDateSafe(b.created_at)?.getTime() || 0;
        return db - da;
      });

      setClaims(list);

      const ids = list.map((c) => c.id);
      if (ids.length) {
        const { data: photos } = await supabase
          .from("claim_photo")
          .select("id, claim_id, bucket, object_key, mime, url")
          .in("claim_id", ids);

        if (photos) {
          const grouped = photos.reduce((acc, p) => {
            acc[p.claim_id] = acc[p.claim_id] || [];
            acc[p.claim_id].push(p);
            return acc;
          }, {});
          setClaimPhotos(grouped);
        } else {
          setClaimPhotos({});
        }
      } else {
        setClaimPhotos({});
      }
    } catch (err) {
      console.error("fetchClaims error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllChats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("conversation_id, user_id, sender, message, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!data || !data.length) {
        setConversations([]);
        return;
      }

      const grouped = {};
      data.forEach((msg) => {
        if (!msg.conversation_id) return;
        if (!grouped[msg.conversation_id]) {
          grouped[msg.conversation_id] = {
            conversation_id: msg.conversation_id,
            user_id: msg.user_id,
            messages: [],
          };
        }
        grouped[msg.conversation_id].messages.push(msg);
      });

      const formatted = Object.values(grouped).map((conv) => {
        const sorted = conv.messages.sort((a, b) => {
          const da = toDateSafe(a.created_at)?.getTime() || 0;
          const db = toDateSafe(b.created_at)?.getTime() || 0;
          return da - db;
        });
        const last = sorted[sorted.length - 1];
        return {
          conversation_id: conv.conversation_id,
          user_id: conv.user_id,
          lastMessage: last.message,
          lastSender: last.sender,
          lastTime: formatDateTimeSK(last.created_at),
          messages: sorted,
        };
      });

      setConversations(formatted);
    } catch (err) {
      console.error("fetchAllChats error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId) => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/messages?user_id=${userId}`);
      const out = await res.json();
      let msgs = out?.data || [];
      msgs = msgs.sort((a, b) => {
        const da = toDateSafe(a.created_at)?.getTime() || 0;
        const db = toDateSafe(b.created_at)?.getTime() || 0;
        return da - db;
      });
      setMessages(msgs);

      const ids = msgs.map((m) => m.id);
      if (ids.length) {
        const { data: photos } = await supabase
          .from("chat_photo")
          .select("id, message_id, bucket, object_key, mime, url")
          .in("message_id", ids);

        if (photos) {
          const grouped = photos.reduce((acc, p) => {
            acc[p.message_id] = acc[p.message_id] || [];
            acc[p.message_id].push(p);
            return acc;
          }, {});
          setChatPhotos(grouped);
        } else {
          setChatPhotos({});
        }
      }

      setTimeout(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }, 200);
    } catch (err) {
      console.error("fetchMessages error:", err);
    }
  };

  useEffect(() => {
    (async () => {
      const cleanShop = isUuid(shopIdApplied) ? shopIdApplied : "";
      const qs = cleanShop ? `?shop_id=${encodeURIComponent(cleanShop)}` : "";
      const res = await fetch(`/api/admin-claims${qs}`);
      if (res.ok) {
        const list = await res.json();
        list.sort((a, b) => {
          const da = toDateSafe(a.created_at)?.getTime() || 0;
          const db = toDateSafe(b.created_at)?.getTime() || 0;
          return db - da;
        });
        setClaims(list);
        setAuthed(true);
        fetchAllChats();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopIdApplied]);

  const filteredClaims = useMemo(() => {
    const term = (filter || "").toLowerCase().trim();
    if (!term) return claims;

    return (claims || []).filter((c) => {
      const hay = [
        c.id,
        c.user_name,
        c.user_email,
        c.order_id,
        c.product_id,
        c.description,
        c.status,
        c.shop_id,
        c.conversation_id,
        formatDateSK(c.created_at),
        formatDateTimeSK(c.created_at),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [claims, filter]);

  useEffect(() => setPage(1), [filter]);

  const totalPages = Math.ceil(filteredClaims.length / perPage) || 1;
  const pageClaims = filteredClaims.slice((page - 1) * perPage, page * perPage);

  // ---------- LOGIN UI ----------
  if (!authed) {
    return (
      <div className="ly-page">
        <div className="ly-shell flex items-center justify-center min-h-[78vh]">
          <div className="ly-card-strong w-[420px] max-w-[92vw] p-7 animate-fadeIn">
            <div className="mb-6">
              <div className="ly-title">Admin</div>
              <div className="ly-muted text-sm mt-1">Prihlásenie do administrácie</div>
            </div>

            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                placeholder="Zadaj heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ly-field pr-14"
              />

              {/* FIX: tlačidlo je vždy vycentrované a neprekrýva input */}
              <button
                type="button"
                className="absolute inset-y-0 right-2 my-auto h-9 px-3 rounded-xl ly-btn-soft text-sm"
                onClick={() => setShowPass((v) => !v)}
                title="Zobraziť / skryť"
              >
                {showPass ? "Skryť" : "Zobraziť"}
              </button>
            </div>

            <button onClick={handleLogin} className="ly-btn ly-btn-primary w-full mt-4">
              Prihlásiť sa
            </button>

            <div className="mt-4 text-xs ly-muted">
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ly-page">
      <div className="ly-shell">
        {/* TOP BAR */}
        <div className="ly-glass ly-header animate-fadeIn">
          <div className="min-w-0">
            <div className="ly-title">Lyvoira Admin</div>
            <div className="ly-subtitle">Reklamácie, prílohy a konverzácie</div>
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            <Link href="/admin" className="ly-btn ly-btn-soft">Admin</Link>
            <Link href="/admin/dashboard" className="ly-btn ly-btn-soft">Dashboard</Link>
            <Link href="/admin/policies" className="ly-btn ly-btn-soft">Policies</Link>

            <button
              onClick={() => {
                setFilter("");
                setPage(1);
                if (tab === "claims") fetchClaims(shopIdApplied);
                if (tab === "messages") fetchAllChats();
              }}
              className="ly-btn ly-btn-soft"
            >
              Refresh
            </button>

            <button onClick={handleLogout} className="ly-btn ly-btn-danger">
              Odhlásiť
            </button>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="mt-4 ly-card p-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4">
              <div className="text-xs ly-muted mb-1">Shop ID (UUID)</div>
              <div className="flex gap-2">
                <input
                  value={shopIdInput}
                  onChange={(e) => setShopIdInput(e.target.value)}
                  placeholder="bc4d82ee-..."
                  className="ly-field"
                />
                <button
                  className="ly-btn ly-btn-primary whitespace-nowrap"
                  onClick={() => {
                    const v = (shopIdInput || "").trim();
                    if (v && !isUuid(v)) {
                      alert("Shop ID musí byť UUID.");
                      return;
                    }
                    setShopIdApplied(v);
                    try {
                      window.localStorage.setItem("lyvoira_shop_id", v);
                    } catch {}
                    fetchClaims(v);
                  }}
                >
                  Použiť
                </button>
                <button
                  className="ly-btn ly-btn-soft whitespace-nowrap"
                  onClick={() => {
                    setShopIdInput("");
                    setShopIdApplied("");
                    try {
                      window.localStorage.setItem("lyvoira_shop_id", "");
                    } catch {}
                    fetchClaims("");
                  }}
                >
                  Zrušiť
                </button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="text-xs ly-muted mb-1">Filter</div>
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="meno, email, produkt, objednávka, dátum..."
                className="ly-field"
              />
            </div>

            <div className="lg:col-span-2 flex items-end">
              <div className="text-xs ly-muted w-full">
                {loading ? "Načítavam..." : `Záznamy: ${filteredClaims.length}`}
              </div>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="mt-4 flex gap-2">
          <button
            className={tab === "claims" ? "ly-btn ly-btn-primary" : "ly-btn ly-btn-soft"}
            onClick={() => {
              setTab("claims");
              setSelectedUser(null);
            }}
          >
            Reklamácie
          </button>
          <button
            className={tab === "messages" ? "ly-btn ly-btn-primary" : "ly-btn ly-btn-soft"}
            onClick={() => {
              setTab("messages");
              fetchAllChats();
            }}
          >
            Chaty
          </button>
        </div>

        {/* CLAIMS */}
        {tab === "claims" && (
          <div className="mt-4 ly-card p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="text-xs ly-muted">
                Shop: <span className="font-medium">{shopIdApplied || "ALL"}</span>
                {"  "}•{"  "}Strana {page} / {totalPages}
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="ly-btn ly-btn-soft px-3"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <button
                  className="ly-btn ly-btn-soft px-3"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="ly-table text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="ly-th">Dátum</th>
                    <th className="ly-th">Meno</th>
                    <th className="ly-th">Email</th>
                    <th className="ly-th">Produkt</th>
                    <th className="ly-th">Popis</th>
                    <th className="ly-th">Prílohy</th>
                    <th className="ly-th text-right">Akcie</th>
                  </tr>
                </thead>

                <tbody>
                  {pageClaims.map((c) => {
                    const jsonAttachments = normalizeAttachments(c.attachments);
                    const photoRows = claimPhotos[c.id] || [];

                    return (
                      <tr key={c.id} className="ly-row">
                        <td className="ly-td whitespace-nowrap">{formatDateSK(c.created_at)}</td>
                        <td className="ly-td">{labelOrDash(c.user_name)}</td>
                        <td className="ly-td">{labelOrDash(c.user_email)}</td>

                        <td className="ly-td max-w-[240px] truncate" title={c.product_id || ""}>
                          {labelOrDash(c.product_id)}
                        </td>

                        <td className="ly-td max-w-[360px] truncate" title={c.description || ""}>
                          {labelOrDash(c.description)}
                        </td>

                        <td className="ly-td">
                          <div className="flex gap-2 flex-wrap">
                            {photoRows.map((ph) => {
                              const src = `/api/file/${ph.bucket}/${ph.object_key}`;
                              const isImg = (ph.mime || "").startsWith("image/");
                              const isVid = (ph.mime || "").startsWith("video/");
                              return (
                                <button
                                  key={ph.id}
                                  className="w-12 h-12 overflow-hidden rounded-2xl border bg-white/80 shadow-sm"
                                  style={{ borderColor: "var(--ly-border)" }}
                                  title={ph.object_key || "attachment"}
                                  onClick={() => window.open(src, "_blank")}
                                >
                                  {isImg ? (
                                    <img src={src} className="w-full h-full object-cover" alt="claim-file" />
                                  ) : isVid ? (
                                    <video src={src} className="w-full h-full object-cover" muted />
                                  ) : (
                                    <div className="w-full h-full grid place-items-center text-[10px] ly-muted">file</div>
                                  )}
                                </button>
                              );
                            })}

                            {jsonAttachments.map((a, idx) => {
                              const url = a.url;
                              const { isImg, isVid } = detectKind(url);
                              return (
                                <button
                                  key={url + idx}
                                  className="w-12 h-12 overflow-hidden rounded-2xl border bg-white/80 shadow-sm"
                                  style={{ borderColor: "var(--ly-border)" }}
                                  title={a.name || url}
                                  onClick={() => window.open(url, "_blank")}
                                >
                                  {isImg ? (
                                    <img src={url} className="w-full h-full object-cover" alt="attachment" />
                                  ) : isVid ? (
                                    <video src={url} className="w-full h-full object-cover" muted />
                                  ) : (
                                    <div className="w-full h-full grid place-items-center text-[10px] ly-muted">link</div>
                                  )}
                                </button>
                              );
                            })}

                            {photoRows.length === 0 && jsonAttachments.length === 0 && (
                              <div className="text-xs ly-muted">bez príloh</div>
                            )}
                          </div>
                        </td>

                        <td className="ly-td">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="ly-btn ly-btn-soft py-2"
                              onClick={() => {
                                setTab("messages");
                                setSelectedUser(c.user_id);
                                fetchMessages(c.user_id);
                              }}
                            >
                              Otvoriť chat
                            </button>

                            <button
                              className="ly-btn ly-btn-soft py-2"
                              title="Detail reklamácie"
                              onClick={() => {
                                setOpenClaim(c);
                                setClaimModalFull(false);
                              }}
                            >
                              Detail
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {pageClaims.length === 0 && (
                    <tr>
                      <td className="py-10 text-center ly-muted" colSpan={7}>
                        Žiadne reklamácie pre tento filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MESSAGES */}
        {tab === "messages" && (
          <div className="mt-4 ly-card p-4 h-[760px] flex flex-col">
            {!selectedUser ? (
              <>
                <div className="ly-h2 mb-3">Konverzácie</div>

                <div
                  className="flex-1 overflow-y-auto rounded-[18px] border p-3 space-y-2"
                  style={{ borderColor: "var(--ly-border)" }}
                >
                  {conversations.length === 0 ? (
                    <div className="text-center mt-10 ly-muted">Zatiaľ žiadne chaty.</div>
                  ) : (
                    conversations.map((conv) => (
                      <button
                        key={conv.conversation_id}
                        className="w-full text-left p-3 rounded-[18px] border bg-white/80 hover:bg-white transition shadow-sm"
                        style={{ borderColor: "var(--ly-border)" }}
                        onClick={() => {
                          setSelectedUser(conv.user_id);
                          fetchMessages(conv.user_id);
                        }}
                      >
                        <div className="flex justify-between items-center gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-[13px] truncate">{conv.user_id}</div>
                            <div className="text-[13px] truncate ly-muted">
                              {conv.lastMessage}
                            </div>
                          </div>
                          <div className="text-[11px] ly-muted whitespace-nowrap">{conv.lastTime}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="ly-h2">Chat</div>
                  <button
                    className="ly-btn ly-btn-soft py-2"
                    onClick={() => {
                      setSelectedUser(null);
                      setMessages([]);
                      setChatPhotos({});
                    }}
                  >
                    Späť
                  </button>
                </div>

                <div
                  ref={chatRef}
                  className="flex-1 overflow-y-auto p-4 rounded-[18px] border flex flex-col gap-3 bg-white/55"
                  style={{ borderColor: "var(--ly-border)" }}
                >
                  {messages.length === 0 ? (
                    <div className="text-center mt-10 ly-muted">Žiadne správy</div>
                  ) : (
                    messages.map((m) => {
                      const attachments = chatPhotos[m.id] || [];
                      const isUser = m.sender === "user";

                      const bubbleStyle = isUser
                        ? {
                            background:
                              "linear-gradient(90deg, rgba(124,58,237,0.92), rgba(236,72,153,0.88), rgba(56,189,248,0.86))",
                            color: "white",
                          }
                        : {
                            background: "rgba(255,255,255,0.92)",
                            border: "1px solid var(--ly-border)",
                            color: "var(--ly-text)",
                          };

                      return (
                        <div
                          key={m.id}
                          className={`px-4 py-3 max-w-[74%] ${isUser ? "self-end ly-bubble-user" : "self-start ly-bubble-ai"}`}
                          style={bubbleStyle}
                        >
                          <div className="text-[13px] whitespace-pre-wrap break-words break-all">
                            {m.message}
                          </div>

                          {attachments.length > 0 && (
                            <div className="mt-2 flex gap-2 flex-wrap">
                              {attachments.map((ph) => (
                                <img
                                  key={ph.id}
                                  src={`/api/file/${ph.bucket}/${ph.object_key}`}
                                  className="w-20 h-20 rounded-2xl object-cover shadow-sm border"
                                  style={{ borderColor: "var(--ly-border)" }}
                                  alt="attachment"
                                />
                              ))}
                            </div>
                          )}

                          <div className="text-[10px] mt-2 opacity-70 text-right">
                            {formatDateTimeSK(m.created_at)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* CLAIM MODAL */}
        {openClaim && (
          <div
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setOpenClaim(null)}
          >
            <div
              className={`ly-card-strong overflow-hidden border ${
                claimModalFull ? "w-[96vw] h-[92vh]" : "w-[980px] max-w-[96vw] max-h-[88vh]"
              } flex flex-col`}
              style={{ borderColor: "var(--ly-border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 flex items-center justify-between gap-3 border-b bg-white/70" style={{ borderColor: "var(--ly-border)" }}>
                <div className="min-w-0">
                  <div className="font-semibold text-[15px]">Detail reklamácie</div>
                  <div className="text-[12px] ly-muted">
                    {formatDateTimeSK(openClaim.created_at)} • {openClaim.user_email || "—"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="ly-btn ly-btn-soft py-2" onClick={() => setClaimModalFull((v) => !v)}>
                    {claimModalFull ? "Zmenšiť" : "Fullscreen"}
                  </button>
                  <button className="ly-btn ly-btn-soft py-2" onClick={() => setOpenClaim(null)}>
                    Zavrieť
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="ly-card p-4">
                    <div className="text-xs ly-muted mb-1">Zákazník</div>
                    <div className="font-semibold">{labelOrDash(openClaim.user_name)}</div>
                    <div className="text-sm break-all">{labelOrDash(openClaim.user_email)}</div>
                  </div>

                  <div className="ly-card p-4">
                    <div className="text-xs ly-muted mb-1">Objednávka</div>
                    <div className="font-semibold break-all">{labelOrDash(openClaim.order_id)}</div>
                    <div className="text-sm">
                      Status: <span className="font-medium">{labelOrDash(openClaim.status)}</span>
                    </div>
                  </div>

                  <div className="ly-card p-4 md:col-span-2">
                    <div className="text-xs ly-muted mb-1">Produkt</div>
                    <div className="font-semibold break-words">{labelOrDash(openClaim.product_id)}</div>
                  </div>

                  <div className="ly-card p-4 md:col-span-2">
                    <div className="text-xs ly-muted mb-1">Popis reklamácie</div>
                    <div className="text-sm whitespace-pre-wrap break-words">{labelOrDash(openClaim.description)}</div>
                  </div>
                </div>

                <div className="mt-4 ly-card p-4">
                  <div className="text-xs ly-muted mb-2">Meta</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div><span className="ly-muted">Claim ID:</span> <span className="font-mono break-all">{labelOrDash(openClaim.id)}</span></div>
                    <div><span className="ly-muted">Shop ID:</span> <span className="font-mono break-all">{labelOrDash(openClaim.shop_id)}</span></div>
                    <div><span className="ly-muted">User ID:</span> <span className="font-mono break-all">{labelOrDash(openClaim.user_id)}</span></div>
                    <div><span className="ly-muted">Conversation ID:</span> <span className="font-mono break-all">{labelOrDash(openClaim.conversation_id)}</span></div>
                    <div><span className="ly-muted">Created:</span> <span className="font-mono">{labelOrDash(formatDateTimeSK(openClaim.created_at))}</span></div>
                    <div><span className="ly-muted">Updated:</span> <span className="font-mono">{labelOrDash(formatDateTimeSK(openClaim.updated_at))}</span></div>
                  </div>
                </div>

                <div className="mt-4 ly-card p-4">
                  <div className="text-xs ly-muted mb-2">Prílohy</div>

                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const photoRows = claimPhotos[openClaim.id] || [];
                      const jsonAttachments = normalizeAttachments(openClaim.attachments);
                      const hasAny = photoRows.length || jsonAttachments.length;

                      if (!hasAny) return <div className="text-sm ly-muted">bez príloh</div>;

                      return (
                        <>
                          {photoRows.map((ph) => {
                            const src = `/api/file/${ph.bucket}/${ph.object_key}`;
                            const isImg = (ph.mime || "").startsWith("image/");
                            const isVid = (ph.mime || "").startsWith("video/");
                            return (
                              <button
                                key={ph.id}
                                className="w-24 h-24 overflow-hidden rounded-2xl shadow-sm border bg-white/85"
                                style={{ borderColor: "var(--ly-border)" }}
                                title={ph.object_key || "attachment"}
                                onClick={() => window.open(src, "_blank")}
                              >
                                {isImg ? (
                                  <img src={src} className="w-full h-full object-cover" alt="claim-file" />
                                ) : isVid ? (
                                  <video src={src} className="w-full h-full object-cover" muted />
                                ) : (
                                  <div className="w-full h-full grid place-items-center text-xs ly-muted">file</div>
                                )}
                              </button>
                            );
                          })}

                          {jsonAttachments.map((a, idx) => {
                            const url = a.url;
                            const { isImg, isVid } = detectKind(url);
                            return (
                              <button
                                key={url + idx}
                                className="w-24 h-24 overflow-hidden rounded-2xl shadow-sm border bg-white/85"
                                style={{ borderColor: "var(--ly-border)" }}
                                title={a.name || url}
                                onClick={() => window.open(url, "_blank")}
                              >
                                {isImg ? (
                                  <img src={url} className="w-full h-full object-cover" alt="attachment" />
                                ) : isVid ? (
                                  <video src={url} className="w-full h-full object-cover" muted />
                                ) : (
                                  <div className="w-full h-full grid place-items-center text-xs ly-muted">link</div>
                                )}
                              </button>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>

                  <div className="mt-4 flex items-center gap-2 flex-wrap">
                    <button
                      className="ly-btn ly-btn-primary"
                      onClick={() => {
                        setOpenClaim(null);
                        setTab("messages");
                        setSelectedUser(openClaim.user_id);
                        fetchMessages(openClaim.user_id);
                      }}
                    >
                      Otvoriť chat
                    </button>

                    <button className="ly-btn ly-btn-soft" onClick={() => setOpenClaim(null)}>
                      Zavrieť
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="h-10" />
      </div>
    </div>
  );
}

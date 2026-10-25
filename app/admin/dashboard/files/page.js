"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

export default function AdminFiles() {
  const [tab, setTab] = useState("chat"); // "chat" | "claims"
  const [chatPhotos, setChatPhotos] = useState([]);
  const [claimPhotos, setClaimPhotos] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchChat = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("chat_photo")
      .select("id, message_id, bucket, object_key, mime, size_bytes, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) setChatPhotos(data || []);
    setLoading(false);
  };

  const fetchClaims = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("claim_photo")
      .select("id, claim_id, bucket, object_key, mime, size_bytes, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) setClaimPhotos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    tab === "chat" ? fetchChat() : fetchClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filteredChat = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chatPhotos;
    return chatPhotos.filter((p) =>
      [p.object_key, p.bucket, p.mime].join(" ").toLowerCase().includes(q)
    );
  }, [chatPhotos, search]);

  const filteredClaim = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return claimPhotos;
    return claimPhotos.filter((p) =>
      [p.object_key, p.bucket, p.mime].join(" ").toLowerCase().includes(q)
    );
  }, [claimPhotos, search]);

  const list = tab === "chat" ? filteredChat : filteredClaim;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-purple-700">📁 Files browser</h1>
        <div className="flex gap-2">
          <button
            onClick={() => (tab === "chat" ? fetchChat() : fetchClaims())}
            className="px-3 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button
          className={`px-4 py-2 rounded ${tab === "chat" ? "bg-purple-600 text-white" : "bg-white border"}`}
          onClick={() => setTab("chat")}
        >
          💬 Chat files
        </button>
        <button
          className={`px-4 py-2 rounded ${tab === "claims" ? "bg-purple-600 text-white" : "bg-white border"}`}
          onClick={() => setTab("claims")}
        >
          📦 Claim files
        </button>

        <input
          placeholder="Hľadať podľa názvu/mime…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2 bg-white w-80 ml-auto"
        />

        {loading && <span className="text-sm text-gray-500">Načítavam…</span>}
      </div>

      {list.length === 0 ? (
        <div className="text-gray-600">Žiadne prílohy.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
          {list.map((p) => {
            const isImg = (p.mime || "").startsWith("image/");
            const isVid = (p.mime || "").startsWith("video/");
            const src = `/api/file/${p.bucket}/${p.object_key}`; // PROXY → signed URL

            return (
              <div key={p.id} className="bg-white rounded-lg shadow hover:shadow-md transition overflow-hidden">
                <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                  {isImg ? (
                    <img src={src} alt={p.object_key} className="object-cover w-full h-full" />
                  ) : isVid ? (
                    <video src={src} className="object-cover w-full h-full" />
                  ) : (
                    <div className="text-xs text-gray-500 p-2 break-all">{p.object_key}</div>
                  )}
                </div>

                <div className="p-3 space-y-1">
                  <div className="text-xs text-gray-800 break-all">{p.object_key}</div>
                  <div className="text-[11px] text-gray-500">{p.mime || "unknown"}</div>
                  <div className="text-[11px] text-gray-500">
                    {p.size_bytes ? `${(p.size_bytes / 1024).toFixed(1)} KB` : "-"}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <a
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-2 py-1 rounded bg-purple-600 text-white hover:bg-purple-700"
                    >
                      Otvoriť
                    </a>
                    <button
                      onClick={() => {
                        const full = `${window.location.origin}${src}`;
                        navigator.clipboard?.writeText(full);
                      }}
                      className="text-xs px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
                    >
                      Kopírovať link
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

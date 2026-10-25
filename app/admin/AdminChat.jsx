//lyvoira_app/app/admin/
"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
);

export default function AdminChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  // realtime všetky správy
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      if (!error) setMessages(data);
    })();

    const channel = supabase
      .channel("admin:chat_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const handleReply = async () => {
    if (!currentUser || !input.trim()) return;
    const res = await fetch("/api/messages", {
      method: "POST",
      body: (() => {
        const fd = new FormData();
        fd.append("user_id", currentUser);
        fd.append("sender", "admin");
        fd.append("message", input);
        return fd;
      })(),
    });
    if (res.ok) setInput("");
  };

  // vyber usera z existujúcich správ
  const users = [...new Set(messages.map((m) => m.user_id))];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Admin Chat</h1>
      <div className="flex gap-4">
        <div className="w-40 border-r">
          <h2 className="font-semibold mb-2">Users</h2>
          {users.map((u) => (
            <div
              key={u}
              onClick={() => setCurrentUser(u)}
              className={`p-2 cursor-pointer ${currentUser === u ? "bg-purple-200" : "hover:bg-gray-100"}`}
            >
              {u}
            </div>
          ))}
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto border p-3 space-y-2">
            {messages
              .filter((m) => m.user_id === currentUser)
              .map((m, i) => (
                <div
                  key={i}
                  className={`p-2 rounded ${m.sender === "user" ? "bg-gray-100" : "bg-purple-100"}`}
                >
                  <b>{m.sender}:</b> {m.message}
                  {m.file_url && (
                    <img src={m.file_url} alt="file" className="mt-1 max-h-32 rounded" />
                  )}
                </div>
              ))}
          </div>

          {currentUser && (
            <div className="flex gap-2 mt-2">
              <input
                className="flex-1 border rounded px-2"
                placeholder="Reply..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleReply()}
              />
              <button
                onClick={handleReply}
                className="bg-purple-600 text-white px-3 rounded"
              >
                Send
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

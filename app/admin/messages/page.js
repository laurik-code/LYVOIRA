//lyvoira_app/app/Admin/messages/page.js
"use client";
import { useEffect, useState } from "react";

export default function AdminMessagesPage({ searchParams }) {
  const [messages, setMessages] = useState([]);
  const userId = searchParams.user_id;

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const res = await fetch(`/api/messages?user_id=${userId}`);
      const data = await res.json();
      setMessages(data.data || []);
    })();
  }, [userId]);

  if (!userId) return <p>❌ Žiadne user_id</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        💬 Chat históriа – {userId}
      </h1>
      <div className="space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-3 rounded ${
              m.sender === "user"
                ? "bg-purple-100 text-right"
                : "bg-gray-100 text-left"
            }`}
          >
            <span className="font-semibold">{m.sender}:</span> {m.message}
          </div>
        ))}
      </div>
    </div>
  );
}

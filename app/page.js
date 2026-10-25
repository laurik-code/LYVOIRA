// app/page.js
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 to-purple-100 p-6">
      {/* Logo / názov */}
      <h1 className="text-6xl font-extrabold text-purple-700 tracking-wide drop-shadow-md">
        Lyvoira
      </h1>
      <p className="mt-2 text-gray-600 text-lg italic">
        Your smart AI assistant for claims & support
      </p>

      {/* Akcie */}
      <div className="mt-10 flex flex-col gap-4">
        {/* Otvoriť chat */}
        <button
          onClick={() => router.push("/chat")}
          className="px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold shadow-md hover:bg-purple-700 transition"
        >
          💬 Open Chat
        </button>

        {/* Admin link */}
        <Link
          href="/admin"
          className="px-6 py-3 rounded-xl bg-gray-200 text-gray-800 font-semibold shadow-md hover:bg-gray-300 transition text-center"
        >
          🔑 Admin Panel
        </Link>
      </div>
    </main>
  );
}


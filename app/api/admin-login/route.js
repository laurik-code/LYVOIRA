// /lyvoira_app/app/api/admin-login/route.js
import { NextResponse } from "next/server";
import { createAdminToken } from "../../../lib/admin-auth";

export async function POST(req) {
  const { password } = await req.json().catch(() => ({}));

  // overenie hesla
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 16 || !password || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const cookieValue = createAdminToken();

  // nastavíme cookie (HttpOnly pre bezpečnosť)
  const res = NextResponse.json({ success: true });
  res.cookies.set("admin_token", cookieValue, {
    httpOnly: true,
    sameSite: "lax", // ✅ FIX: strict býva zbytočne prísne
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 2, // 2 hodiny
    path: "/",
  });

  return res;
}

// voliteľne – GET môže slúžiť na test
export async function GET() {
  return NextResponse.json({ ok: true });
}

import { verifyAdminCookie } from "../../../lib/admin-auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);



export async function GET(req) {
  if (!verifyAdminCookie(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get("user_id");

  try {
    let query = supabase.from("messages").select("*").order("created_at", { ascending: false });
    if (user_id) query = query.eq("user_id", user_id);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

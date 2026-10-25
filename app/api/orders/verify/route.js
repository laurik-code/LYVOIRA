import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use the public/anon key: order verification must not use a service-role key.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || process.env.SUPABASE_KEY;


export async function POST(req) {
  try {
    const { order_id, user_email } = await req.json();
    if (!order_id || !user_email) {
      return NextResponse.json({ valid: false, reason: "Missing fields" }, { status: 400 });
    }
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ valid: false, error: "Supabase is not configured" }, { status: 503 });
    }
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
      .from("orders")
      .select("order_id")
      .eq("order_id", order_id)
      .eq("user_email", user_email)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ valid: !!data });
  } catch (e) {
    return NextResponse.json({ valid: false, error: "Order verification failed" }, { status: 500 });
  }
}

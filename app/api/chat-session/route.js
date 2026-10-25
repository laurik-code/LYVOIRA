
import { NextResponse } from "next/server";
import {
  createChatSession,
  verifyChatSession,
} from "../../../lib/chat-session";

export async function GET(req) {
  try {
    const existingUserId = verifyChatSession(req);

    if (existingUserId) {
      return NextResponse.json({
        success: true,
        user_id: existingUserId,
      });
    }

    const session = createChatSession();

    const response = NextResponse.json({
      success: true,
      user_id: session.userId,
    });

    response.cookies.set(session.cookieName, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: session.maxAge,
    });

    return response;
  } catch (error) {
    console.error("[CHAT SESSION]", error);

    return NextResponse.json(
      { success: false, error: "Could not create chat session." },
      { status: 500 }
    );
  }
}

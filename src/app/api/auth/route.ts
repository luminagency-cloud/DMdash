import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, authEnabled, expectedToken, passwordMatches } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!authEnabled()) {
    return NextResponse.json({ ok: true, authDisabled: true });
  }
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!passwordMatches(String(password || ""))) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { COOKIE_NAME, cookieValid } from "./auth";

export function apiAuthed(): boolean {
  const value = cookies().get(COOKIE_NAME)?.value;
  return cookieValid(value);
}

export function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

// For server components / pages: bounce to the login screen when locked.
export function requirePageAuth() {
  if (!apiAuthed()) redirect("/login");
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { COOKIE_NAME, cookieValid } from "./auth";

export async function apiAuthed(): Promise<boolean> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return cookieValid(value);
}

export function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

// For server components / pages: bounce to the login screen when locked.
export async function requirePageAuth() {
  if (!(await apiAuthed())) redirect("/login");
}

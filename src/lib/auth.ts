import { createHash, timingSafeEqual } from "crypto";

export const COOKIE_NAME = "cb_auth";

export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD && process.env.APP_PASSWORD.length > 0;
}

// The cookie stores a hash of the password (never the raw password), so a
// leaked cookie does not reveal the secret and the check is a simple compare.
export function expectedToken(): string {
  const secret = process.env.APP_PASSWORD || "";
  return createHash("sha256").update(`cb:${secret}`).digest("hex");
}

export function passwordMatches(input: string): boolean {
  const expected = process.env.APP_PASSWORD || "";
  if (expected.length === 0) return true;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function cookieValid(value: string | undefined): boolean {
  if (!authEnabled()) return true;
  if (!value) return false;
  return value === expectedToken();
}

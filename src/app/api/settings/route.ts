import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";
import { apiAuthed, unauthorized } from "@/lib/guard";
import { Settings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!apiAuthed()) return unauthorized();
  const ds = await getDataSource();
  const settings = await ds.getSettings();
  return NextResponse.json({ settings, backend: ds.backend });
}

export async function PATCH(req: NextRequest) {
  if (!apiAuthed()) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const patch: Partial<Settings> = {};
  if (typeof body.snoozeDays === "number") patch.snoozeDays = clamp(body.snoozeDays, 1, 365);
  if (typeof body.warmAfterDays === "number") patch.warmAfterDays = clamp(body.warmAfterDays, 1, 365);
  if (typeof body.staleAfterDays === "number") patch.staleAfterDays = clamp(body.staleAfterDays, 1, 365);
  if (body.wipLimit === null) patch.wipLimit = null;
  else if (typeof body.wipLimit === "number") patch.wipLimit = clamp(body.wipLimit, 1, 99);
  const ds = await getDataSource();
  const settings = await ds.updateSettings(patch);
  return NextResponse.json({ settings });
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

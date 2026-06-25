import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";
import { apiAuthed, unauthorized } from "@/lib/guard";
import { toProjectView } from "@/lib/aging";
import { Lane, Project } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET a single project. Opening it counts as "touching" it, which resets aging.
export async function GET(_req: NextRequest, { params }: Params) {
  if (!apiAuthed()) return unauthorized();
  const ds = await getDataSource();
  const existing = await ds.getProject(params.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const touched = await ds.updateProject(params.id, { lastTouched: new Date().toISOString() });
  const settings = await ds.getSettings();
  return NextResponse.json({ project: toProjectView(touched, settings) });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!apiAuthed()) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const patch: Partial<Project> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.lane === "string") patch.lane = body.lane as Lane;
  if (typeof body.position === "number") patch.position = body.position;
  if (typeof body.notes === "string") patch.notes = body.notes;
  if (Array.isArray(body.repos)) patch.repos = body.repos.map((r: string) => r.trim()).filter(Boolean);
  if (typeof body.archived === "boolean") patch.archived = body.archived;
  if (body.snoozeUntil === null || typeof body.snoozeUntil === "string") {
    patch.snoozeUntil = body.snoozeUntil;
  }

  // Editing or moving a card counts as touching it, unless the caller opts out
  // (e.g. a bulk reorder of cards the user did not actually open).
  if (body.touch !== false) patch.lastTouched = new Date().toISOString();

  const ds = await getDataSource();
  const updated = await ds.updateProject(params.id, patch);
  const settings = await ds.getSettings();
  return NextResponse.json({ project: toProjectView(updated, settings) });
}

// Default DELETE archives (soft). Pass ?hard=1 to permanently remove.
export async function DELETE(req: NextRequest, { params }: Params) {
  if (!apiAuthed()) return unauthorized();
  const ds = await getDataSource();
  const hard = new URL(req.url).searchParams.get("hard") === "1";
  if (hard) {
    await ds.deleteProject(params.id);
  } else {
    await ds.updateProject(params.id, { archived: true });
  }
  return NextResponse.json({ ok: true });
}

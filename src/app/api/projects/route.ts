import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";
import { apiAuthed, unauthorized } from "@/lib/guard";
import { hasWoken, toProjectView } from "@/lib/aging";
import { Project } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!apiAuthed()) return unauthorized();
  const ds = await getDataSource();
  const [settings, projects] = await Promise.all([ds.getSettings(), ds.listProjects()]);
  const now = new Date();

  // Auto-bubble: snoozed cards whose window elapsed move back to Unlabeled so
  // they resurface. lastTouched is left untouched so aging colour flags them.
  const woke = projects.filter((p) => hasWoken(p, now));
  if (woke.length > 0) {
    const maxUnlabeled = Math.max(
      -1,
      ...projects.filter((p) => p.lane === "unlabeled").map((p) => p.position)
    );
    let pos = maxUnlabeled + 1;
    for (const w of woke) {
      await ds.updateProject(w.id, { lane: "unlabeled", snoozeUntil: null, position: pos });
      const ref = projects.find((p) => p.id === w.id) as Project;
      ref.lane = "unlabeled";
      ref.snoozeUntil = null;
      ref.position = pos;
      pos += 1;
    }
  }

  const views = projects.map((p) => toProjectView(p, settings, now));
  return NextResponse.json({ projects: views, settings, backend: ds.backend });
}

export async function POST(req: NextRequest) {
  if (!apiAuthed()) return unauthorized();
  const body = await req.json().catch(() => ({}));
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const ds = await getDataSource();
  const project = await ds.createProject({
    name: body.name.trim(),
    lane: body.lane || "unlabeled",
    notes: body.notes || "",
    repos: Array.isArray(body.repos) ? body.repos : [],
  });
  const settings = await ds.getSettings();
  return NextResponse.json({ project: toProjectView(project, settings) });
}

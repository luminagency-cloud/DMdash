import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";
import { apiAuthed, unauthorized } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List local to-dos for a project: GET /api/tasks?projectId=...
export async function GET(req: NextRequest) {
  if (!apiAuthed()) return unauthorized();
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  const ds = await getDataSource();
  const tasks = await ds.listTasks(projectId);
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  if (!apiAuthed()) return unauthorized();
  const body = await req.json().catch(() => ({}));
  if (!body.projectId || !body.title) {
    return NextResponse.json({ error: "projectId and title required" }, { status: 400 });
  }
  const ds = await getDataSource();
  const task = await ds.createTask({ projectId: body.projectId, title: String(body.title).trim() });
  // Editing a project's to-dos is real work → touch it.
  await ds.updateProject(body.projectId, { lastTouched: new Date().toISOString() });
  return NextResponse.json({ task });
}

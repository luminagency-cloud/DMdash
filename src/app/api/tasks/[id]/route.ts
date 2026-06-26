import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";
import { apiAuthed, unauthorized } from "@/lib/guard";
import { Task } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

const now = () => new Date().toISOString();

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!apiAuthed()) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const patch: Partial<Task> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.done === "boolean") patch.done = body.done;
  if (typeof body.order === "number") patch.order = body.order;
  const ds = await getDataSource();
  const task = await ds.updateTask(params.id, patch);
  // Editing a to-do counts as touching its project.
  if (task.projectId) await ds.updateProject(task.projectId, { lastTouched: now() });
  return NextResponse.json({ task });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!apiAuthed()) return unauthorized();
  const ds = await getDataSource();
  await ds.deleteTask(params.id);
  // Client passes ?projectId so we can touch the project on delete too.
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (projectId) await ds.updateProject(projectId, { lastTouched: now() });
  return NextResponse.json({ ok: true });
}

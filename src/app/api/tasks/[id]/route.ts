import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";
import { apiAuthed, unauthorized } from "@/lib/guard";
import { Task } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!apiAuthed()) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const patch: Partial<Task> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.done === "boolean") patch.done = body.done;
  if (typeof body.order === "number") patch.order = body.order;
  const ds = await getDataSource();
  const task = await ds.updateTask(params.id, patch);
  return NextResponse.json({ task });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  if (!apiAuthed()) return unauthorized();
  const ds = await getDataSource();
  await ds.deleteTask(params.id);
  return NextResponse.json({ ok: true });
}

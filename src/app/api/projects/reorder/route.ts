import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "@/lib/datasource";
import { apiAuthed, unauthorized } from "@/lib/guard";
import { Lane } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Persist a drag-and-drop result. The client sends only the cards whose lane or
// position changed. Only the card the user actually dragged (movedId) gets its
// lastTouched bumped — reordering neighbours should not reset their aging.
export async function POST(req: NextRequest) {
  if (!apiAuthed()) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const items: { id: string; lane: Lane; position: number }[] = Array.isArray(body.items) ? body.items : [];
  const movedId: string | undefined = body.movedId;
  const snoozeUntil: string | null | undefined = body.snoozeUntil;

  const ds = await getDataSource();
  await Promise.all(
    items.map((it) => {
      const patch: any = { lane: it.lane, position: it.position };
      if (it.id === movedId) {
        patch.lastTouched = new Date().toISOString();
        // Dragging into Snooze sets the snooze window; dragging out clears it.
        if (it.lane === "snooze" && snoozeUntil) patch.snoozeUntil = snoozeUntil;
        if (it.lane !== "snooze") patch.snoozeUntil = null;
      }
      return ds.updateProject(it.id, patch);
    })
  );
  return NextResponse.json({ ok: true });
}

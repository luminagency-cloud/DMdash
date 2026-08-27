import { NextRequest, NextResponse } from "next/server";
import { apiAuthed, unauthorized } from "@/lib/guard";
import {
  archiveTrelloCard,
  createTrelloCard,
  readCommandBoard,
  trelloConfigured,
  updateTrelloCard,
  updateTrelloBoard,
} from "@/lib/trello";

export const dynamic = "force-dynamic";

function failed(error: unknown) {
  const message = error instanceof Error ? error.message : "Trello request failed";
  return NextResponse.json({ error: message }, { status: 502 });
}

export async function GET(req: NextRequest) {
  if (!(await apiAuthed())) return unauthorized();
  if (req.nextUrl.searchParams.get("status") === "1") {
    return NextResponse.json({ configured: trelloConfigured(), backend: "trello" });
  }
  try {
    return NextResponse.json(await readCommandBoard());
  } catch (error) {
    return failed(error);
  }
}

export async function POST(req: NextRequest) {
  if (!(await apiAuthed())) return unauthorized();
  try {
    const body = await req.json();
    if (!body.listId || !String(body.name || "").trim()) {
      return NextResponse.json({ error: "listId and name are required" }, { status: 400 });
    }
    const card = await createTrelloCard({
      listId: String(body.listId),
      name: String(body.name).trim(),
      description: String(body.description || ""),
    });
    return NextResponse.json({ card });
  } catch (error) {
    return failed(error);
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await apiAuthed())) return unauthorized();
  try {
    const body = await req.json();
    if (body.boardId) {
      const board = await updateTrelloBoard(String(body.boardId), String(body.description || ""));
      return NextResponse.json({ board });
    }
    if (!body.cardId) return NextResponse.json({ error: "cardId is required" }, { status: 400 });
    const card = await updateTrelloCard(String(body.cardId), {
      name: body.name === undefined ? undefined : String(body.name).trim(),
      description: body.description === undefined ? undefined : String(body.description),
      listId: body.listId === undefined ? undefined : String(body.listId),
      position: typeof body.position === "number"
        ? body.position
        : body.position === "bottom"
          ? "bottom"
          : body.position === "top"
            ? "top"
            : undefined,
    });
    return NextResponse.json({ card });
  } catch (error) {
    return failed(error);
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await apiAuthed())) return unauthorized();
  try {
    const cardId = req.nextUrl.searchParams.get("cardId");
    if (!cardId) return NextResponse.json({ error: "cardId is required" }, { status: 400 });
    await archiveTrelloCard(cardId);
    return NextResponse.json({ archived: true });
  } catch (error) {
    return failed(error);
  }
}

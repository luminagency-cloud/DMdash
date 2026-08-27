export type CreateCardInput = {
  listId: string;
  name: string;
  description: string;
};

export function parseCreateCardInput(body: unknown): CreateCardInput | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const listId = String(input.listId || "").trim();
  const name = String(input.name || "").trim();
  if (!listId || !name) return null;
  return { listId, name, description: String(input.description || "") };
}

export function cardIdFrom(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const cardId = String((body as Record<string, unknown>).cardId || "").trim();
  return cardId || null;
}

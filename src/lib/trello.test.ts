import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readCommandBoard, stageFor } from "./trello";

describe("stageFor", () => {
  it.each([
    ["2do", "todo"], ["To Do", "todo"], ["Backlog", "todo"],
    ["Next Up", "next"], ["Doing", "progress"], ["Blocked", "waiting"], ["Completed", "done"],
  ])("maps %s to %s", (name, stage) => expect(stageFor(name)).toBe(stage));

  it("ignores an unrelated list", () => expect(stageFor("Reference" )).toBeUndefined());
});

describe("readCommandBoard", () => {
  beforeEach(() => {
    process.env.TRELLO_API_KEY = "test-key";
    process.env.TRELLO_TOKEN = "test-token";
  });

  afterEach(() => vi.unstubAllGlobals());

  it("selects workflow boards and converts their cards", async () => {
    const responses = new Map<string, unknown>([
      ["/1/members/me/boards", [
        { id: "board-1", name: "Product", desc: "Board notes", url: "https://trello.test/b/1" },
        { id: "board-2", name: "Unrelated", url: "https://trello.test/b/2" },
      ]],
      ["/1/boards/board-1/lists", [
        { id: "list-todo", name: "2do" },
        { id: "list-next", name: "Next Up" },
        { id: "list-other", name: "Reference" },
      ]],
      ["/1/boards/board-1/cards", [
        { id: "card-1", name: "Ship it", desc: "Details", idList: "list-next", labels: [{ id: "label-1", name: "Priority", color: "red" }], due: null, dateLastActivity: "2026-08-27T12:00:00.000Z", url: "https://trello.test/c/1", pos: 1024, checklists: [{ checkItems: [{ state: "complete" }, { state: "incomplete" }] }] },
        { id: "card-hidden", name: "Hidden", idList: "list-other", dateLastActivity: "2026-08-27T12:00:00.000Z", url: "https://trello.test/c/2", pos: 2048 },
      ]],
      ["/1/boards/board-2/lists", [{ id: "list-notes", name: "Notes" }]],
      ["/1/boards/board-2/cards", []],
    ]);

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const body = responses.get(url.pathname);
      if (body === undefined) return new Response("Not found", { status: 404 });
      return Response.json(body);
    }));

    const result = await readCommandBoard();

    expect(result.boards).toHaveLength(1);
    expect(result.boards[0]).toMatchObject({ id: "board-1", description: "Board notes", lists: { todo: "list-todo", next: "list-next" } });
    expect(result.cards).toEqual([expect.objectContaining({ id: "card-1", stage: "next", checklistTotal: 2, checklistComplete: 1 })]);
    expect(result.missingWorkflow[0].missing).toEqual(["progress", "waiting", "done"]);
  });
});

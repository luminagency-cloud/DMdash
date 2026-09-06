import { describe, expect, it } from "vitest";
import { commandBoardPayload, stageFor, toolData } from "./trello";

describe("stageFor", () => {
  it.each([
    ["2do", "todo"], ["To Do", "todo"], ["Backlog", "todo"],
    ["Next Up", "next"], ["Doing", "progress"], ["Blocked", "waiting"], ["Completed", "done"],
  ])("maps %s to %s", (name, stage) => expect(stageFor(name)).toBe(stage));

  it("ignores an unrelated list", () => expect(stageFor("Reference" )).toBeUndefined());
});

describe("toolData", () => {
  it("returns the MCP error text", () => {
    expect(() => toolData({
      isError: true,
      content: [{ type: "text", text: "Trello request failed (401): invalid key" }],
    })).toThrow("Trello request failed (401): invalid key");
  });

  it("uses a fallback when the MCP error has no text", () => {
    expect(() => toolData({ isError: true, content: [] })).toThrow("The Trello MCP tool reported an error.");
  });
});

describe("commandBoardPayload", () => {
  it("selects workflow boards and converts their cards", async () => {
    const boards = [
      { id: "board-1", name: "Product", desc: "Board notes", url: "https://trello.test/b/1" },
      { id: "board-2", name: "Unrelated", url: "https://trello.test/b/2" },
    ];
    const boardData = new Map([
      ["board-1", { lists: [
        { id: "list-todo", name: "2do" },
        { id: "list-next", name: "Next Up" },
        { id: "list-other", name: "Reference" },
      ], cards: [
        { id: "card-1", idBoard: "board-1", name: "Ship it", desc: "Details", idList: "list-next", labels: [{ id: "label-1", name: "Priority", color: "red" }], due: null, dateLastActivity: "2026-08-27T12:00:00.000Z", url: "https://trello.test/c/1", pos: 1024, checklists: [{ checkItems: [{ state: "complete" }, { state: "incomplete" }] }] },
        { id: "card-hidden", idBoard: "board-1", name: "Hidden", idList: "list-other", dateLastActivity: "2026-08-27T12:00:00.000Z", url: "https://trello.test/c/2", pos: 2048 },
      ] }],
      ["board-2", { lists: [{ id: "list-notes", name: "Notes" }], cards: [] }],
    ]);
    const result = commandBoardPayload(boards, boardData);

    expect(result.boards).toHaveLength(1);
    expect(result.boards[0]).toMatchObject({ id: "board-1", description: "Board notes", lists: { todo: "list-todo", next: "list-next" } });
    expect(result.cards).toEqual([expect.objectContaining({ id: "card-1", stage: "next", checklistTotal: 2, checklistComplete: 1 })]);
    expect(result.missingWorkflow[0].missing).toEqual(["progress", "waiting", "done"]);
  });
});

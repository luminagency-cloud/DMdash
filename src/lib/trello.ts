import { Client, StreamableHTTPClientTransport, type CallToolResult } from "@modelcontextprotocol/client";
import { WORKFLOW_LABELS, type CommandBoardPayload, type TrelloBoard, type TrelloLabel, type TrelloWorkCard, type WorkflowStage } from "./types";

type RawBoard = { id: string; name: string; desc?: string; url: string };
type RawList = { id: string; name: string };
type RawChecklist = { checkItems?: { state: string }[] };
type RawCard = { id: string; idBoard: string; name: string; desc?: string; idList: string; labels?: TrelloLabel[]; due?: string | null; dateLastActivity: string; url: string; pos: number; checklists?: RawChecklist[] };

function configuration() {
  const url = process.env.TRELLO_MCP_URL;
  const token = process.env.TRELLO_MCP_TOKEN;
  if (!url || !token) throw new Error("Trello MCP is not configured. Add TRELLO_MCP_URL and TRELLO_MCP_TOKEN.");
  return { url, token };
}

export function trelloConfigured() {
  return !!process.env.TRELLO_MCP_URL && !!process.env.TRELLO_MCP_TOKEN;
}

async function withClient<T>(operation: (client: Client) => Promise<T>): Promise<T> {
  const { url, token } = configuration();
  const client = new Client({ name: "dmdash", version: "2.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(url), { authProvider: { token: async () => token } });
  await client.connect(transport);
  try {
    return await operation(client);
  } finally {
    await client.close();
  }
}

export function toolData<T>(result: CallToolResult): T {
  if (result.isError) {
    const detail = result.content
      .filter((content) => content.type === "text")
      .map((content) => content.text.trim())
      .filter(Boolean)
      .join(" ")
      .slice(0, 500);
    throw new Error(detail || "The Trello MCP tool reported an error.");
  }
  const item = result.content.find((content) => content.type === "text");
  if (!item || item.type !== "text") throw new Error("The Trello MCP tool returned no JSON data.");
  return JSON.parse(item.text) as T;
}

async function callTool<T>(client: Client, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await client.callTool({ name, arguments: args });
  return toolData<T>(result);
}

const aliases: Record<string, WorkflowStage> = {
  "2do": "todo", "to do": "todo", todo: "todo", backlog: "todo", "next up": "next", next: "next",
  working: "progress", "in progress": "progress", doing: "progress", waiting: "waiting", blocked: "waiting",
  done: "done", complete: "done", completed: "done",
};

export function stageFor(name: string): WorkflowStage | undefined {
  return aliases[name.trim().toLowerCase()];
}

export async function readCommandBoard(): Promise<CommandBoardPayload> {
  return withClient(async (client) => {
    const rawBoards = await callTool<RawBoard[]>(client, "list_boards");
    const entries = await Promise.all(rawBoards.map(async (board) => [board.id, await callTool<{ lists: RawList[]; cards: RawCard[] }>(client, "get_board_data", { boardId: board.id })] as const));
    return commandBoardPayload(rawBoards, new Map(entries));
  });
}

export function commandBoardPayload(rawBoards: RawBoard[], boardData: Map<string, { lists: RawList[]; cards: RawCard[] }>): CommandBoardPayload {
    const boardResults = rawBoards.map((rawBoard) => {
      const data = boardData.get(rawBoard.id);
      if (!data) throw new Error(`Trello MCP returned no data for board ${rawBoard.id}.`);
      const lists: TrelloBoard["lists"] = {};
      const stageByList = new Map<string, WorkflowStage>();
      for (const list of data.lists) {
        const stage = stageFor(list.name);
        if (stage && !lists[stage]) { lists[stage] = list.id; stageByList.set(list.id, stage); }
      }
      const board: TrelloBoard = { id: rawBoard.id, name: rawBoard.name, description: rawBoard.desc || "", url: rawBoard.url, lists };
      const cards: TrelloWorkCard[] = data.cards.flatMap((card) => {
        const stage = stageByList.get(card.idList);
        if (!stage) return [];
        const items = (card.checklists || []).flatMap((checklist) => checklist.checkItems || []);
        return [{ id: card.id, boardId: rawBoard.id, boardName: rawBoard.name, boardUrl: rawBoard.url, listId: card.idList, stage,
          name: card.name, description: card.desc || "", labels: card.labels || [], due: card.due || null,
          checklistTotal: items.length, checklistComplete: items.filter((item) => item.state === "complete").length,
          lastActivityAt: card.dateLastActivity, url: card.url, position: card.pos }];
      });
      return { board, cards };
    });
    const commandBoards = boardResults.filter((result) => Object.keys(result.board.lists).length > 0);
    const stages = Object.keys(WORKFLOW_LABELS) as WorkflowStage[];
    return {
      boards: commandBoards.map((result) => result.board),
      cards: commandBoards.flatMap((result) => result.cards),
      missingWorkflow: commandBoards.flatMap(({ board }) => {
        const missing = stages.filter((stage) => !board.lists[stage]);
        return missing.length ? [{ boardId: board.id, boardName: board.name, missing }] : [];
      }),
      syncedAt: new Date().toISOString(),
    };
}

export async function createTrelloCard(input: { listId: string; name: string; description?: string }) {
  return withClient(async (client) => {
    const boards = await callTool<RawBoard[]>(client, "list_boards");
    for (const board of boards) {
      const data = await callTool<{ lists: RawList[] }>(client, "get_board_data", { boardId: board.id });
      if (data.lists.some((list) => list.id === input.listId)) {
        return callTool<RawCard>(client, "create_card", { boardId: board.id, listId: input.listId, title: input.name, description: input.description || "" });
      }
    }
    throw new Error("The selected Trello list is not available.");
  });
}

export async function updateTrelloCard(cardId: string, input: { name?: string; description?: string; listId?: string; position?: "top" | "bottom" | number }) {
  return withClient((client) => callTool<RawCard>(client, "update_card", { cardId, ...input }));
}

export async function archiveTrelloCard(cardId: string) {
  return withClient((client) => callTool<RawCard>(client, "archive_card", { cardId }));
}

export async function updateTrelloBoard(boardId: string, description: string) {
  return withClient((client) => callTool<RawBoard>(client, "update_board_description", { boardId, description }));
}

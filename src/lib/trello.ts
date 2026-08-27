import {
  WORKFLOW_LABELS,
  type CommandBoardPayload,
  type TrelloBoard,
  type TrelloLabel,
  type TrelloWorkCard,
  type WorkflowStage,
} from "./types";

const API = "https://api.trello.com/1";

type RawBoard = { id: string; name: string; desc?: string; url: string };
type RawList = { id: string; name: string };
type RawChecklist = { checkItems?: { state: string }[] };
type RawCard = {
  id: string;
  name: string;
  desc?: string;
  idList: string;
  labels?: TrelloLabel[];
  due?: string | null;
  dateLastActivity: string;
  url: string;
  pos: number;
  checklists?: RawChecklist[];
};

function credentials() {
  const key = process.env.TRELLO_API_KEY;
  const token = process.env.TRELLO_TOKEN;
  if (!key || !token) {
    throw new Error("Trello is not configured. Add TRELLO_API_KEY and TRELLO_TOKEN.");
  }
  return { key, token };
}

export function trelloConfigured() {
  return !!process.env.TRELLO_API_KEY && !!process.env.TRELLO_TOKEN;
}

async function request<T>(path: string, init?: RequestInit, params?: Record<string, string>) {
  const auth = credentials();
  const url = new URL(`${API}${path}`);
  url.searchParams.set("key", auth.key);
  url.searchParams.set("token", auth.token);
  for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value);

  const response = await fetch(url, { ...init, cache: "no-store" });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Trello ${response.status}: ${body || response.statusText}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const aliases: Record<string, WorkflowStage> = {
  "2do": "todo",
  "to do": "todo",
  todo: "todo",
  backlog: "todo",
  "next up": "next",
  next: "next",
  working: "progress",
  "in progress": "progress",
  doing: "progress",
  waiting: "waiting",
  blocked: "waiting",
  done: "done",
  complete: "done",
  completed: "done",
};

export function stageFor(name: string): WorkflowStage | undefined {
  return aliases[name.trim().toLowerCase()];
}

export async function readCommandBoard(): Promise<CommandBoardPayload> {
  const rawBoards = await request<RawBoard[]>("/members/me/boards", undefined, {
    filter: "open",
    fields: "name,desc,url",
  });

  const boardResults = await Promise.all(
    rawBoards.map(async (rawBoard) => {
      const [rawLists, rawCards] = await Promise.all([
        request<RawList[]>(`/boards/${rawBoard.id}/lists`, undefined, { filter: "open", fields: "name" }),
        request<RawCard[]>(`/boards/${rawBoard.id}/cards`, undefined, {
          filter: "open",
          fields: "name,desc,idList,labels,due,dateLastActivity,url,pos",
          checklists: "all",
          checkItem_fields: "state",
        }),
      ]);

      const lists: TrelloBoard["lists"] = {};
      const stageByList = new Map<string, WorkflowStage>();
      for (const list of rawLists) {
        const stage = stageFor(list.name);
        if (stage && !lists[stage]) {
          lists[stage] = list.id;
          stageByList.set(list.id, stage);
        }
      }

      const board: TrelloBoard = { id: rawBoard.id, name: rawBoard.name, description: rawBoard.desc || "", url: rawBoard.url, lists };
      const cards: TrelloWorkCard[] = rawCards.flatMap((card) => {
        const stage = stageByList.get(card.idList);
        if (!stage) return [];
        const items = (card.checklists || []).flatMap((checklist) => checklist.checkItems || []);
        return [{
          id: card.id,
          boardId: rawBoard.id,
          boardName: rawBoard.name,
          boardUrl: rawBoard.url,
          listId: card.idList,
          stage,
          name: card.name,
          description: card.desc || "",
          labels: card.labels || [],
          due: card.due || null,
          checklistTotal: items.length,
          checklistComplete: items.filter((item) => item.state === "complete").length,
          lastActivityAt: card.dateLastActivity,
          url: card.url,
          position: card.pos,
        }];
      });
      return { board, cards };
    })
  );

  // Ignore Trello boards that do not contain any recognized workflow list.
  // This keeps unrelated boards out of Dmdash without maintaining a second
  // selection database. Adding one standard list opts a board in.
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
  return request<RawCard>("/cards", { method: "POST" }, {
    idList: input.listId,
    name: input.name,
    desc: input.description || "",
    pos: "top",
  });
}

export async function updateTrelloCard(
  cardId: string,
  input: { name?: string; description?: string; listId?: string; position?: "top" | "bottom" | number }
) {
  const params: Record<string, string> = {};
  if (input.name !== undefined) params.name = input.name;
  if (input.description !== undefined) params.desc = input.description;
  if (input.listId !== undefined) params.idList = input.listId;
  if (input.position !== undefined) params.pos = String(input.position);
  return request<RawCard>(`/cards/${cardId}`, { method: "PUT" }, params);
}

export async function archiveTrelloCard(cardId: string) {
  return request<RawCard>(`/cards/${cardId}`, { method: "PUT" }, { closed: "true" });
}

export async function updateTrelloBoard(boardId: string, description: string) {
  return request<RawBoard>(`/boards/${boardId}`, { method: "PUT" }, { desc: description });
}

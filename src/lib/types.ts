// Trello-backed command board domain. Trello remains the source of truth:
// board = project, list = workflow stage, card = work item.
export type WorkflowStage = "todo" | "next" | "progress" | "waiting" | "done";

export const ACTIVE_STAGES: WorkflowStage[] = ["todo", "next", "progress", "waiting"];

export const WORKFLOW_LABELS: Record<WorkflowStage, string> = {
  todo: "2do",
  next: "Next Up",
  progress: "Working",
  waiting: "Waiting",
  done: "Done",
};

export interface TrelloBoard {
  id: string;
  name: string;
  description: string;
  url: string;
  lists: Partial<Record<WorkflowStage, string>>;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string | null;
}

export interface TrelloWorkCard {
  id: string;
  boardId: string;
  boardName: string;
  boardUrl: string;
  listId: string;
  stage: WorkflowStage;
  name: string;
  description: string;
  labels: TrelloLabel[];
  due: string | null;
  checklistTotal: number;
  checklistComplete: number;
  lastActivityAt: string;
  url: string;
  position: number;
}

export interface CommandBoardPayload {
  boards: TrelloBoard[];
  cards: TrelloWorkCard[];
  missingWorkflow: { boardId: string; boardName: string; missing: WorkflowStage[] }[];
  syncedAt: string;
}

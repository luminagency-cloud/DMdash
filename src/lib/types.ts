// Shared domain types for Command Board.

export type Lane = "today" | "next" | "unlabeled" | "snooze";

export const LANES: Lane[] = ["today", "next", "unlabeled", "snooze"];

export const LANE_LABELS: Record<Lane, string> = {
  today: "Today",
  next: "Next",
  unlabeled: "Unlabeled",
  snooze: "Snooze",
};

export interface Project {
  id: string;
  name: string;
  lane: Lane;
  position: number; // ordering within a lane (ascending)
  notes: string; // markdown
  repos: string[]; // "owner/repo" entries; a project may link several
  lastTouched: string; // ISO timestamp
  snoozeUntil: string | null; // ISO timestamp; when set and in the future, card is snoozed
  createdAt: string; // ISO timestamp
  archived: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  done: boolean;
  order: number;
  createdAt: string;
}

export interface Settings {
  snoozeDays: number; // default 7
  warmAfterDays: number; // card turns "warm" after this many untouched days
  staleAfterDays: number; // card turns "stale" after this many untouched days
  wipLimit: number | null; // max cards in Today before a warning; null = off
}

export const DEFAULT_SETTINGS: Settings = {
  snoozeDays: 7,
  warmAfterDays: 3,
  staleAfterDays: 7,
  wipLimit: 4,
};

export type AgingStage = "fresh" | "warm" | "stale" | "snoozed";

export interface GitHubIssue {
  repo: string; // "owner/repo"
  number: number;
  title: string;
  state: "open" | "closed";
  url: string;
  body: string;
  labels: string[];
  comments: number;
  updatedAt: string;
}

// Shape returned to the client for a project, enriched with computed fields.
export interface ProjectView extends Project {
  agingStage: AgingStage;
  daysUntouched: number;
  woke: boolean; // a snoozed card whose snooze window has elapsed
}

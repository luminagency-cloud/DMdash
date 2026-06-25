import { Project, Settings, Task } from "./types";

// Storage-agnostic contract. Implemented by the Airtable adapter (production)
// and the in-memory mock adapter (demo / local dev without credentials).
export interface DataSource {
  backend: "airtable" | "mock";
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(input: { name: string } & Partial<Project>): Promise<Project>;
  updateProject(id: string, patch: Partial<Project>): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  listTasks(projectId: string): Promise<Task[]>;
  createTask(input: { projectId: string; title: string }): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
}

export function airtableConfigured(): boolean {
  return (
    !!process.env.AIRTABLE_API_KEY &&
    !!process.env.AIRTABLE_BASE_ID &&
    process.env.AIRTABLE_API_KEY.length > 0 &&
    process.env.AIRTABLE_BASE_ID.length > 0
  );
}

let cached: DataSource | null = null;

// Lazily build (and cache) the right adapter. Dynamic imports keep the unused
// adapter's deps out of each request path.
export async function getDataSource(): Promise<DataSource> {
  if (cached) return cached;
  if (airtableConfigured()) {
    const { AirtableSource } = await import("./airtable");
    cached = new AirtableSource();
  } else {
    const { MockSource } = await import("./mock");
    cached = new MockSource();
  }
  return cached;
}

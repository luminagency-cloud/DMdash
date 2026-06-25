import { DataSource } from "./datasource";
import { DEFAULT_SETTINGS, Lane, Project, Settings, Task } from "./types";

const API = "https://api.airtable.com/v0";

const T = {
  projects: process.env.AIRTABLE_PROJECTS_TABLE || "Projects",
  tasks: process.env.AIRTABLE_TASKS_TABLE || "Tasks",
  settings: process.env.AIRTABLE_SETTINGS_TABLE || "Settings",
};

// Tolerate a base ID pasted straight from an Airtable URL (app.../tbl.../viw...);
// only the leading app… id is valid for the REST API.
function baseId(): string {
  return (process.env.AIRTABLE_BASE_ID || "").trim().split("/")[0];
}

function baseUrl(table: string): string {
  return `${API}/${baseId()}/${encodeURIComponent(table)}`;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function at(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable ${res.status}: ${text.slice(0, 400)}`);
  }
  return res;
}

const LANE_TO_LABEL: Record<Lane, string> = {
  today: "Now",
  next: "Next",
  unlabeled: "Unlabeled",
  snooze: "Snooze",
};

function labelToLane(label: string | undefined): Lane {
  switch ((label || "").toLowerCase()) {
    case "now":
    case "today":
      return "today";
    case "next":
      return "next";
    case "snooze":
      return "snooze";
    default:
      return "unlabeled";
  }
}

interface ATRecord {
  id: string;
  fields: Record<string, any>;
}

function toProject(rec: ATRecord): Project {
  const f = rec.fields;
  const reposRaw: string = f.Repos || "";
  return {
    id: rec.id,
    name: f.Name || "Untitled",
    lane: labelToLane(f.Lane),
    position: typeof f.Position === "number" ? f.Position : 0,
    notes: f.Notes || "",
    repos: reposRaw
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean),
    lastTouched: f.LastTouched || rec.fields.CreatedAt || new Date().toISOString(),
    snoozeUntil: f.SnoozeUntil || null,
    createdAt: f.CreatedAt || new Date().toISOString(),
    archived: !!f.Archived,
  };
}

function projectFields(p: Partial<Project>): Record<string, any> {
  const f: Record<string, any> = {};
  if (p.name !== undefined) f.Name = p.name;
  if (p.lane !== undefined) f.Lane = LANE_TO_LABEL[p.lane];
  if (p.position !== undefined) f.Position = p.position;
  if (p.notes !== undefined) f.Notes = p.notes;
  if (p.repos !== undefined) f.Repos = p.repos.join("\n");
  if (p.lastTouched !== undefined) f.LastTouched = p.lastTouched;
  if (p.snoozeUntil !== undefined) f.SnoozeUntil = p.snoozeUntil; // null clears
  if (p.createdAt !== undefined) f.CreatedAt = p.createdAt;
  if (p.archived !== undefined) f.Archived = p.archived;
  return f;
}

function toTask(rec: ATRecord): Task {
  const f = rec.fields;
  return {
    id: rec.id,
    projectId: f.ProjectId || "",
    title: f.Title || "",
    done: !!f.Done,
    order: typeof f.Order === "number" ? f.Order : 0,
    createdAt: f.CreatedAt || new Date().toISOString(),
  };
}

async function listAll(table: string, params: Record<string, string> = {}): Promise<ATRecord[]> {
  const out: ATRecord[] = [];
  let offset: string | undefined;
  do {
    const qs = new URLSearchParams({ pageSize: "100", ...params });
    if (offset) qs.set("offset", offset);
    const res = await at(`${baseUrl(table)}?${qs.toString()}`);
    const data = await res.json();
    out.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return out;
}

export class AirtableSource implements DataSource {
  backend = "airtable" as const;

  async listProjects(): Promise<Project[]> {
    const recs = await listAll(T.projects, { filterByFormula: "NOT({Archived})" });
    return recs.map(toProject).sort((a, b) => a.position - b.position);
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      const res = await at(`${baseUrl(T.projects)}/${id}`);
      return toProject(await res.json());
    } catch {
      return null;
    }
  }

  async createProject(input: { name: string } & Partial<Project>): Promise<Project> {
    const now = new Date().toISOString();
    const existing = await this.listProjects();
    const lane = input.lane || "unlabeled";
    const maxPos = Math.max(-1, ...existing.filter((p) => p.lane === lane).map((p) => p.position));
    const fields = projectFields({
      ...input,
      lane,
      position: input.position ?? maxPos + 1,
      lastTouched: now,
      createdAt: now,
      archived: false,
    });
    const res = await at(baseUrl(T.projects), {
      method: "POST",
      body: JSON.stringify({ fields, typecast: true }),
    });
    return toProject(await res.json());
  }

  async updateProject(id: string, patch: Partial<Project>): Promise<Project> {
    const res = await at(`${baseUrl(T.projects)}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields: projectFields(patch), typecast: true }),
    });
    return toProject(await res.json());
  }

  async deleteProject(id: string): Promise<void> {
    await at(`${baseUrl(T.projects)}/${id}`, { method: "DELETE" });
    const tasks = await this.listTasks(id);
    await Promise.all(tasks.map((t) => this.deleteTask(t.id)));
  }

  async listTasks(projectId: string): Promise<Task[]> {
    const recs = await listAll(T.tasks, {
      filterByFormula: `{ProjectId}='${projectId.replace(/'/g, "")}'`,
    });
    return recs.map(toTask).sort((a, b) => a.order - b.order);
  }

  async createTask(input: { projectId: string; title: string }): Promise<Task> {
    const existing = await this.listTasks(input.projectId);
    const maxOrder = Math.max(-1, ...existing.map((t) => t.order));
    const res = await at(baseUrl(T.tasks), {
      method: "POST",
      body: JSON.stringify({
        fields: {
          Title: input.title,
          ProjectId: input.projectId,
          Done: false,
          Order: maxOrder + 1,
          CreatedAt: new Date().toISOString(),
        },
        typecast: true,
      }),
    });
    return toTask(await res.json());
  }

  async updateTask(id: string, patch: Partial<Task>): Promise<Task> {
    const fields: Record<string, any> = {};
    if (patch.title !== undefined) fields.Title = patch.title;
    if (patch.done !== undefined) fields.Done = patch.done;
    if (patch.order !== undefined) fields.Order = patch.order;
    const res = await at(`${baseUrl(T.tasks)}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields, typecast: true }),
    });
    return toTask(await res.json());
  }

  async deleteTask(id: string): Promise<void> {
    await at(`${baseUrl(T.tasks)}/${id}`, { method: "DELETE" });
  }

  async getSettings(): Promise<Settings> {
    const recs = await listAll(T.settings);
    if (recs.length === 0) return { ...DEFAULT_SETTINGS };
    const f = recs[0].fields;
    return {
      snoozeDays: typeof f.SnoozeDays === "number" ? f.SnoozeDays : DEFAULT_SETTINGS.snoozeDays,
      warmAfterDays: typeof f.WarmAfterDays === "number" ? f.WarmAfterDays : DEFAULT_SETTINGS.warmAfterDays,
      staleAfterDays: typeof f.StaleAfterDays === "number" ? f.StaleAfterDays : DEFAULT_SETTINGS.staleAfterDays,
      wipLimit: typeof f.WipLimit === "number" ? f.WipLimit : DEFAULT_SETTINGS.wipLimit,
    };
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const recs = await listAll(T.settings);
    const fields: Record<string, any> = {};
    if (patch.snoozeDays !== undefined) fields.SnoozeDays = patch.snoozeDays;
    if (patch.warmAfterDays !== undefined) fields.WarmAfterDays = patch.warmAfterDays;
    if (patch.staleAfterDays !== undefined) fields.StaleAfterDays = patch.staleAfterDays;
    if (patch.wipLimit !== undefined) fields.WipLimit = patch.wipLimit;
    if (recs.length === 0) {
      const merged = { ...DEFAULT_SETTINGS, ...patch };
      await at(baseUrl(T.settings), {
        method: "POST",
        body: JSON.stringify({
          fields: {
            SnoozeDays: merged.snoozeDays,
            WarmAfterDays: merged.warmAfterDays,
            StaleAfterDays: merged.staleAfterDays,
            WipLimit: merged.wipLimit,
          },
          typecast: true,
        }),
      });
      return merged;
    }
    await at(`${baseUrl(T.settings)}/${recs[0].id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields, typecast: true }),
    });
    return this.getSettings();
  }
}

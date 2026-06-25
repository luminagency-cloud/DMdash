import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { DataSource } from "./datasource";
import { DEFAULT_SETTINGS, Project, Settings, Task } from "./types";

// File-backed in-memory store for demo / local dev. Lets the app run with zero
// credentials and persists across restarts so you can actually play with it.
const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

interface DB {
  projects: Project[];
  tasks: Task[];
  settings: Settings;
}

function iso(daysAgo = 0): string {
  return new Date(Date.now() - daysAgo * 86400000).toISOString();
}

function seed(): DB {
  const p = (over: Partial<Project> & { name: string }): Project => ({
    id: randomUUID(),
    name: over.name,
    lane: over.lane || "unlabeled",
    position: over.position ?? 0,
    notes: over.notes || "",
    repos: over.repos || [],
    lastTouched: over.lastTouched || iso(0),
    snoozeUntil: over.snoozeUntil ?? null,
    createdAt: over.createdAt || iso(10),
    archived: false,
  });

  const projects: Project[] = [
    p({
      name: "Command Board (this app)",
      lane: "today",
      position: 0,
      repos: ["youruser/command-board"],
      notes: "## The dashboard itself\nShip the v1: board, project detail, aging + snooze.",
      lastTouched: iso(0),
    }),
    p({
      name: "Client site redesign",
      lane: "today",
      position: 1,
      notes: "Homepage hero + pricing page. Waiting on final copy.",
      lastTouched: iso(1),
    }),
    p({
      name: "Clean the backyard",
      lane: "next",
      position: 0,
      notes: "No repo — a real-world project. Lives entirely in local to-dos.",
      lastTouched: iso(2),
    }),
    p({
      name: "Newsletter automation",
      lane: "next",
      position: 1,
      repos: ["youruser/newsletter", "youruser/email-templates"],
      notes: "Two repos: the sender and the templates.",
      lastTouched: iso(5),
    }),
    p({
      name: "Tax docs for accountant",
      lane: "unlabeled",
      position: 0,
      notes: "Gather receipts, export reports.",
      lastTouched: iso(9),
    }),
    p({
      name: "Old prototype to revisit",
      lane: "snooze",
      position: 0,
      repos: ["youruser/prototype"],
      notes: "Parked. Will bubble back up.",
      lastTouched: iso(12),
      snoozeUntil: iso(-4), // wakes in 4 days
    }),
  ];

  const byName = (n: string) => projects.find((x) => x.name === n)!.id;
  const tasks: Task[] = [
    { id: randomUUID(), projectId: byName("Clean the backyard"), title: "Buy soil and mulch", done: false, order: 0, createdAt: iso(2) },
    { id: randomUUID(), projectId: byName("Clean the backyard"), title: "Dig the new beds", done: false, order: 1, createdAt: iso(2) },
    { id: randomUUID(), projectId: byName("Clean the backyard"), title: "Plant tomatoes", done: true, order: 2, createdAt: iso(2) },
    { id: randomUUID(), projectId: byName("Tax docs for accountant"), title: "Export Q1 + Q2 reports", done: false, order: 0, createdAt: iso(9) },
  ];

  return { projects, tasks, settings: { ...DEFAULT_SETTINGS } };
}

async function load(): Promise<DB> {
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    const db = JSON.parse(raw) as DB;
    if (!db.settings) db.settings = { ...DEFAULT_SETTINGS };
    return db;
  } catch {
    const db = seed();
    await save(db);
    return db;
  }
}

async function save(db: DB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

export class MockSource implements DataSource {
  backend = "mock" as const;

  async listProjects(): Promise<Project[]> {
    const db = await load();
    return db.projects.filter((p) => !p.archived);
  }

  async getProject(id: string): Promise<Project | null> {
    const db = await load();
    return db.projects.find((p) => p.id === id) || null;
  }

  async createProject(input: { name: string } & Partial<Project>): Promise<Project> {
    const db = await load();
    const lane = input.lane || "unlabeled";
    const maxPos = Math.max(-1, ...db.projects.filter((p) => p.lane === lane).map((p) => p.position));
    const proj: Project = {
      id: randomUUID(),
      name: input.name,
      lane,
      position: input.position ?? maxPos + 1,
      notes: input.notes || "",
      repos: input.repos || [],
      lastTouched: new Date().toISOString(),
      snoozeUntil: input.snoozeUntil ?? null,
      createdAt: new Date().toISOString(),
      archived: false,
    };
    db.projects.push(proj);
    await save(db);
    return proj;
  }

  async updateProject(id: string, patch: Partial<Project>): Promise<Project> {
    const db = await load();
    const i = db.projects.findIndex((p) => p.id === id);
    if (i < 0) throw new Error("Project not found");
    db.projects[i] = { ...db.projects[i], ...patch, id };
    await save(db);
    return db.projects[i];
  }

  async deleteProject(id: string): Promise<void> {
    const db = await load();
    db.projects = db.projects.filter((p) => p.id !== id);
    db.tasks = db.tasks.filter((t) => t.projectId !== id);
    await save(db);
  }

  async listTasks(projectId: string): Promise<Task[]> {
    const db = await load();
    return db.tasks.filter((t) => t.projectId === projectId).sort((a, b) => a.order - b.order);
  }

  async createTask(input: { projectId: string; title: string }): Promise<Task> {
    const db = await load();
    const maxOrder = Math.max(-1, ...db.tasks.filter((t) => t.projectId === input.projectId).map((t) => t.order));
    const task: Task = {
      id: randomUUID(),
      projectId: input.projectId,
      title: input.title,
      done: false,
      order: maxOrder + 1,
      createdAt: new Date().toISOString(),
    };
    db.tasks.push(task);
    await save(db);
    return task;
  }

  async updateTask(id: string, patch: Partial<Task>): Promise<Task> {
    const db = await load();
    const i = db.tasks.findIndex((t) => t.id === id);
    if (i < 0) throw new Error("Task not found");
    db.tasks[i] = { ...db.tasks[i], ...patch, id };
    await save(db);
    return db.tasks[i];
  }

  async deleteTask(id: string): Promise<void> {
    const db = await load();
    db.tasks = db.tasks.filter((t) => t.id !== id);
    await save(db);
  }

  async getSettings(): Promise<Settings> {
    const db = await load();
    return db.settings;
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const db = await load();
    db.settings = { ...db.settings, ...patch };
    await save(db);
    return db.settings;
  }
}

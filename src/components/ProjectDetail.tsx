"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import { api } from "@/lib/client";
import { LANES, LANE_LABELS, type GitHubIssue, type Lane, type ProjectView, type Settings, type Task } from "@/lib/types";

interface RepoState {
  issues: GitHubIssue[];
  enabled: boolean;
  loading: boolean;
  error: string | null;
}

export default function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<ProjectView | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [repoState, setRepoState] = useState<Record<string, RepoState>>({});
  const [notesDraft, setNotesDraft] = useState("");
  const [notesEditing, setNotesEditing] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newRepo, setNewRepo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadIssues = useCallback(async (repo: string) => {
    setRepoState((s) => ({ ...s, [repo]: { issues: [], enabled: true, loading: true, error: null } }));
    try {
      const data = await api<{ issues: GitHubIssue[]; githubEnabled: boolean }>(
        `/api/github/issues?repo=${encodeURIComponent(repo)}`
      );
      setRepoState((s) => ({
        ...s,
        [repo]: { issues: data.issues, enabled: data.githubEnabled, loading: false, error: null },
      }));
    } catch (e: any) {
      setRepoState((s) => ({
        ...s,
        [repo]: { issues: [], enabled: true, loading: false, error: e.message || "Failed" },
      }));
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [{ project }, { settings }, { tasks }] = await Promise.all([
          api<{ project: ProjectView }>(`/api/projects/${projectId}`),
          api<{ settings: Settings }>("/api/settings"),
          api<{ tasks: Task[] }>(`/api/tasks?projectId=${projectId}`),
        ]);
        setProject(project);
        setSettings(settings);
        setNotesDraft(project.notes);
        setTasks(tasks);
        project.repos.forEach((r) => loadIssues(r));
      } catch (e: any) {
        setError(e.message || "Failed to load project");
      }
    })();
  }, [projectId, loadIssues]);

  async function patchProject(patch: Partial<ProjectView>, touch = true) {
    if (!project) return;
    const { project: updated } = await api<{ project: ProjectView }>(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, touch }),
    });
    setProject(updated);
  }

  async function saveNotes() {
    setNotesEditing(false);
    if (project && notesDraft !== project.notes) await patchProject({ notes: notesDraft }); // editing notes is real work → touch
  }

  // Changing lane / snoozing is organizing, not working → touch = false.
  async function changeLane(lane: Lane) {
    await patchProject(
      { lane, snoozeUntil: lane === "snooze" && settings ? new Date(Date.now() + settings.snoozeDays * 86400000).toISOString() : null },
      false
    );
  }

  async function snooze() {
    if (!settings) return;
    await patchProject(
      { lane: "snooze", snoozeUntil: new Date(Date.now() + settings.snoozeDays * 86400000).toISOString() },
      false
    );
  }

  async function addRepo() {
    const repo = newRepo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
    if (!repo || !project) return;
    if (!/^[^/]+\/[^/]+$/.test(repo)) {
      setError("Repo must look like owner/name");
      return;
    }
    if (project.repos.includes(repo)) {
      setNewRepo("");
      return;
    }
    await patchProject({ repos: [...project.repos, repo] }, false);
    setNewRepo("");
    loadIssues(repo);
  }

  async function removeRepo(repo: string) {
    if (!project) return;
    await patchProject({ repos: project.repos.filter((r) => r !== repo) }, false);
    setRepoState((s) => {
      const c = { ...s };
      delete c[repo];
      return c;
    });
  }

  async function addTask() {
    const title = newTask.trim();
    if (!title) return;
    const { task } = await api<{ task: Task }>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ projectId, title }),
    });
    setTasks((t) => [...t, task]);
    setNewTask("");
    const fresh = await api<{ tasks: Task[] }>(`/api/tasks?projectId=${projectId}`);
    setTasks(fresh.tasks);
  }

  async function toggleTask(task: Task) {
    const { task: updated } = await api<{ task: Task }>(`/api/tasks/${task.id}`, {
      method: "PATCH",
      body: JSON.stringify({ done: !task.done }),
    });
    setTasks((list) => list.map((t) => (t.id === task.id ? updated : t)));
  }

  async function deleteTask(id: string) {
    await api(`/api/tasks/${id}?projectId=${projectId}`, { method: "DELETE" });
    setTasks((list) => list.filter((t) => t.id !== id));
  }

  async function archive() {
    if (!confirm("Archive this project? It leaves the board but stays in your data.")) return;
    await api(`/api/projects/${projectId}`, { method: "DELETE" });
    router.push("/");
  }

  if (error) return <div className="board-status error">{error}</div>;
  if (!project) return <div className="board-status">Loading…</div>;

  return (
    <div className="detail">
      <div className="detail-top">
        <button className="link-back" onClick={() => router.push("/")}>
          ← Board
        </button>
        <div className="detail-actions">
          <select className="lane-select" value={project.lane} onChange={(e) => changeLane(e.target.value as Lane)}>
            {LANES.map((l) => (
              <option key={l} value={l}>
                {LANE_LABELS[l]}
              </option>
            ))}
          </select>
          {project.lane !== "snooze" && (
            <button className="btn" onClick={snooze}>
              Snooze {settings ? `${settings.snoozeDays}d` : ""}
            </button>
          )}
          <button className="btn btn-danger" onClick={archive}>
            Archive
          </button>
        </div>
      </div>

      <input
        className="detail-title"
        value={project.name}
        onChange={(e) => setProject({ ...project, name: e.target.value })}
        onBlur={() => patchProject({ name: project.name })}
      />
      <div className={`detail-aging age-${project.agingStage}`}>
        {project.agingStage === "snoozed"
          ? `Snoozed — wakes ${project.snoozeUntil ? new Date(project.snoozeUntil).toLocaleDateString() : "soon"}`
          : project.daysUntouched === 0
          ? "Touched today"
          : `${project.daysUntouched} days untouched`}
      </div>

      <div className="detail-grid">
        {/* Left: notes */}
        <section className="panel">
          <div className="panel-head">
            <h2>Notes</h2>
            {!notesEditing && (
              <button className="btn-ghost" onClick={() => setNotesEditing(true)}>
                Edit
              </button>
            )}
          </div>
          {notesEditing ? (
            <textarea
              className="notes-edit"
              autoFocus
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={saveNotes}
              placeholder="Markdown supported…"
            />
          ) : project.notes ? (
            <div className="notes-view" dangerouslySetInnerHTML={{ __html: marked.parse(project.notes) as string }} />
          ) : (
            <div className="notes-empty" onClick={() => setNotesEditing(true)}>
              No notes yet — click to add.
            </div>
          )}
        </section>

        {/* Right: to-dos on top, then one issues block per linked repo, then repo linker */}
        <div className="detail-right">
          <section className="panel">
            <div className="panel-head">
              <h2>To-dos</h2>
              <span className="muted">{tasks.filter((t) => !t.done).length} open</span>
            </div>
            <div className="task-add">
              <input
                value={newTask}
                placeholder="Add a to-do…"
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
              />
              <button className="btn" onClick={addTask}>
                Add
              </button>
            </div>
            <ul className="task-list">
              {tasks.map((t) => (
                <li key={t.id} className={t.done ? "done" : ""}>
                  <label>
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t)} />
                    <span>{t.title}</span>
                  </label>
                  <button className="task-del" onClick={() => deleteTask(t.id)} aria-label="delete">
                    ×
                  </button>
                </li>
              ))}
              {tasks.length === 0 && <li className="muted">No to-dos yet.</li>}
            </ul>
          </section>

          {project.repos.map((repo) => (
            <RepoSection
              key={repo}
              repo={repo}
              projectId={projectId}
              state={repoState[repo]}
              onRemove={() => removeRepo(repo)}
              onReload={() => loadIssues(repo)}
              onMutate={() => loadIssues(repo)}
            />
          ))}

          <section className="panel">
            <div className="repo-add">
              <input
                value={newRepo}
                placeholder="Link a repo (owner/repo)"
                onChange={(e) => setNewRepo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRepo()}
              />
              <button className="btn" onClick={addRepo}>
                Link
              </button>
            </div>
            {project.repos.length === 0 && (
              <p className="muted" style={{ margin: 0 }}>
                No repos linked. Link one to pull its GitHub issues here.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function RepoSection({
  repo,
  projectId,
  state,
  onRemove,
  onReload,
  onMutate,
}: {
  repo: string;
  projectId: string;
  state: RepoState | undefined;
  onRemove: () => void;
  onReload: () => void;
  onMutate: () => void;
}) {
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [commentFor, setCommentFor] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  async function createIssue() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await api("/api/github/issues", { method: "POST", body: JSON.stringify({ repo, title: title.trim(), projectId }) });
      setTitle("");
      onMutate();
    } finally {
      setCreating(false);
    }
  }

  async function closeIssue(num: number) {
    await api("/api/github/issues", {
      method: "PATCH",
      body: JSON.stringify({ repo, number: num, action: "close", projectId }),
    });
    onMutate();
  }

  async function sendComment(num: number) {
    if (!comment.trim()) return;
    await api("/api/github/issues", {
      method: "PATCH",
      body: JSON.stringify({ repo, number: num, action: "comment", body: comment.trim(), projectId }),
    });
    setComment("");
    setCommentFor(null);
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>
          Issues ·{" "}
          <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer" className="repo-name">
            {repo}
          </a>
        </h2>
        <div>
          <button className="btn-ghost" onClick={onReload}>
            Refresh
          </button>
          <button className="btn-ghost" onClick={onRemove}>
            Unlink
          </button>
        </div>
      </div>

      {!state || state.loading ? (
        <p className="muted">Loading issues…</p>
      ) : !state.enabled ? (
        <p className="muted">Set GITHUB_TOKEN in .env.local to pull and manage issues.</p>
      ) : state.error ? (
        <p className="muted error">{state.error}</p>
      ) : (
        <>
          <div className="issue-create">
            <input
              value={title}
              placeholder="New issue title…"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createIssue()}
            />
            <button className="btn" disabled={creating} onClick={createIssue}>
              {creating ? "…" : "Create"}
            </button>
          </div>
          <ul className="issue-list">
            {state.issues.map((i) => (
              <li key={i.number}>
                <div className="issue-row">
                  <input type="checkbox" title="Close issue" checked={false} onChange={() => closeIssue(i.number)} />
                  <a href={i.url} target="_blank" rel="noopener noreferrer">
                    #{i.number} {i.title}
                  </a>
                  <button className="btn-ghost" onClick={() => setCommentFor(commentFor === i.number ? null : i.number)}>
                    💬
                  </button>
                </div>
                {commentFor === i.number && (
                  <div className="issue-comment">
                    <textarea value={comment} placeholder="Comment…" onChange={(e) => setComment(e.target.value)} />
                    <button className="btn" onClick={() => sendComment(i.number)}>
                      Send
                    </button>
                  </div>
                )}
              </li>
            ))}
            {state.issues.length === 0 && <li className="muted">No open issues 🎉</li>}
          </ul>
        </>
      )}
    </section>
  );
}

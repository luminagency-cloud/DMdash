import { GitHubIssue } from "./types";

const API = "https://api.github.com";

export function githubEnabled(): boolean {
  return !!process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.length > 0;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "command-board",
    "Content-Type": "application/json",
  };
}

async function gh(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
}

// List open issues for a repo ("owner/repo"). Excludes pull requests.
export async function listIssues(repo: string): Promise<GitHubIssue[]> {
  const res = await gh(`/repos/${repo}/issues?state=open&per_page=50&sort=updated`);
  const data = (await res.json()) as any[];
  return data
    .filter((i) => !i.pull_request)
    .map((i) => ({
      repo,
      number: i.number,
      title: i.title,
      state: i.state,
      url: i.html_url,
      body: i.body || "",
      labels: (i.labels || []).map((l: any) => (typeof l === "string" ? l : l.name)),
      comments: i.comments || 0,
      updatedAt: i.updated_at,
    }));
}

export async function createIssue(
  repo: string,
  title: string,
  body: string
): Promise<GitHubIssue> {
  const res = await gh(`/repos/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify({ title, body }),
  });
  const i = await res.json();
  return {
    repo,
    number: i.number,
    title: i.title,
    state: i.state,
    url: i.html_url,
    body: i.body || "",
    labels: (i.labels || []).map((l: any) => (typeof l === "string" ? l : l.name)),
    comments: i.comments || 0,
    updatedAt: i.updated_at,
  };
}

export async function closeIssue(repo: string, num: number): Promise<void> {
  await gh(`/repos/${repo}/issues/${num}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed" }),
  });
}

export async function reopenIssue(repo: string, num: number): Promise<void> {
  await gh(`/repos/${repo}/issues/${num}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "open" }),
  });
}

export async function commentIssue(
  repo: string,
  num: number,
  body: string
): Promise<void> {
  await gh(`/repos/${repo}/issues/${num}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

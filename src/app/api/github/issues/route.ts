import { NextRequest, NextResponse } from "next/server";
import { apiAuthed, unauthorized } from "@/lib/guard";
import { closeIssue, commentIssue, createIssue, githubEnabled, listIssues, reopenIssue } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/github/issues?repo=owner/repo  -> open issues for a repo.
export async function GET(req: NextRequest) {
  if (!apiAuthed()) return unauthorized();
  const repo = new URL(req.url).searchParams.get("repo");
  if (!repo) return NextResponse.json({ error: "repo required" }, { status: 400 });
  if (!githubEnabled()) {
    return NextResponse.json({ issues: [], githubEnabled: false });
  }
  try {
    const issues = await listIssues(repo);
    return NextResponse.json({ issues, githubEnabled: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "github error", issues: [] }, { status: 502 });
  }
}

// POST create an issue: { repo, title, body }
export async function POST(req: NextRequest) {
  if (!apiAuthed()) return unauthorized();
  if (!githubEnabled()) return NextResponse.json({ error: "GitHub not configured" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  if (!body.repo || !body.title) {
    return NextResponse.json({ error: "repo and title required" }, { status: 400 });
  }
  try {
    const issue = await createIssue(body.repo, String(body.title), String(body.body || ""));
    return NextResponse.json({ issue });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "github error" }, { status: 502 });
  }
}

// PATCH mutate an issue: { repo, number, action: 'close'|'reopen'|'comment', body? }
export async function PATCH(req: NextRequest) {
  if (!apiAuthed()) return unauthorized();
  if (!githubEnabled()) return NextResponse.json({ error: "GitHub not configured" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const { repo, number, action } = body;
  if (!repo || !number || !action) {
    return NextResponse.json({ error: "repo, number, action required" }, { status: 400 });
  }
  try {
    if (action === "close") await closeIssue(repo, number);
    else if (action === "reopen") await reopenIssue(repo, number);
    else if (action === "comment") await commentIssue(repo, number, String(body.body || ""));
    else return NextResponse.json({ error: "unknown action" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "github error" }, { status: 502 });
  }
}

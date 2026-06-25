#!/usr/bin/env node
// Slurp all your GitHub repos into the board as Unlabeled projects, each with
// its README in the notes. Idempotent: repos already linked to a project are
// skipped, so it's safe to re-run as you add repos. Run: npm run import:repos
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const KEY = process.env.AIRTABLE_API_KEY;
const BASE = (process.env.AIRTABLE_BASE_ID || "").trim().split("/")[0];
const GH = process.env.GITHUB_TOKEN;
const PROJECTS = process.env.AIRTABLE_PROJECTS_TABLE || "Projects";
const MAX_NOTES = 40000; // keep well under Airtable's long-text limit

if (!KEY || !BASE) {
  console.error("✗ Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env.local first.");
  process.exit(1);
}
if (!GH) {
  console.error("✗ Set GITHUB_TOKEN in .env.local first.");
  process.exit(1);
}

const AT = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const GHH = {
  Authorization: `Bearer ${GH}`,
  "User-Agent": "command-board",
  "X-GitHub-Api-Version": "2022-11-28",
};
const atUrl = (t) => `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(t)}`;

// Which repos are already linked to a project (so re-runs don't duplicate).
async function existingRepos() {
  const set = new Set();
  let offset;
  do {
    const qs = new URLSearchParams({ pageSize: "100", "fields[]": "Repos" });
    if (offset) qs.set("offset", offset);
    const res = await fetch(`${atUrl(PROJECTS)}?${qs}`, { headers: AT });
    if (!res.ok) throw new Error(`Airtable list failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    for (const r of data.records || []) {
      (r.fields.Repos || "")
        .split(/\r?\n|,/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .forEach((x) => set.add(x));
    }
    offset = data.offset;
  } while (offset);
  return set;
}

async function allRepos() {
  const out = [];
  for (let page = 1; ; page++) {
    const url = `https://api.github.com/user/repos?per_page=100&affiliation=owner&sort=full_name&page=${page}`;
    const res = await fetch(url, { headers: GHH });
    if (!res.ok) throw new Error(`GitHub repos failed (${res.status}): ${await res.text()}`);
    const arr = await res.json();
    out.push(...arr);
    if (arr.length < 100) break;
  }
  return out;
}

async function readme(full) {
  const res = await fetch(`https://api.github.com/repos/${full}/readme`, {
    headers: { ...GHH, Accept: "application/vnd.github.raw" },
  });
  if (!res.ok) return "";
  const text = await res.text();
  return text.length > MAX_NOTES ? text.slice(0, MAX_NOTES) + "\n\n…(truncated)" : text;
}

async function createBatch(records) {
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10);
    const res = await fetch(atUrl(PROJECTS), {
      method: "POST",
      headers: AT,
      body: JSON.stringify({ records: chunk, typecast: true }),
    });
    if (!res.ok) throw new Error(`Airtable create failed (${res.status}): ${await res.text()}`);
  }
}

(async () => {
  console.log("Reading existing projects…");
  const have = await existingRepos();
  console.log("Fetching your GitHub repos…");
  const repos = await allRepos();
  const todo = repos.filter((r) => !have.has(r.full_name.toLowerCase()));
  console.log(`${repos.length} repos found, ${todo.length} new to import.`);

  const now = new Date().toISOString();
  const records = [];
  let pos = 0;
  for (const r of todo) {
    process.stdout.write(`• ${r.full_name} … `);
    const notes = await readme(r.full_name);
    records.push({
      fields: {
        Name: r.name,
        Lane: "Unlabeled",
        Position: pos++,
        Repos: r.full_name,
        Notes: notes || r.description || "",
        LastTouched: now,
        CreatedAt: now,
        Archived: false,
      },
    });
    console.log(notes ? "readme ✓" : "no readme");
  }

  if (records.length === 0) {
    console.log("Nothing new to import.");
    return;
  }
  console.log(`Creating ${records.length} projects…`);
  await createBatch(records);
  console.log("✓ Done — they're waiting in the Unlabeled band.");
})().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});

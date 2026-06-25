#!/usr/bin/env node
// Optional: drop a Settings row + a couple sample projects into your Airtable
// base so it isn't empty on first run. Run: npm run seed:airtable
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const KEY = process.env.AIRTABLE_API_KEY;
const BASE = process.env.AIRTABLE_BASE_ID;
if (!KEY || !BASE) {
  console.error("✗ Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env first.");
  process.exit(1);
}
const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const iso = (d = 0) => new Date(Date.now() - d * 86400000).toISOString();

async function post(table, records) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ records, typecast: true }),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

(async () => {
  await post(process.env.AIRTABLE_SETTINGS_TABLE || "Settings", [
    { fields: { Name: "global", SnoozeDays: 7, WarmAfterDays: 3, StaleAfterDays: 7, WipLimit: 4 } },
  ]);
  await post(process.env.AIRTABLE_PROJECTS_TABLE || "Projects", [
    { fields: { Name: "Command Board (this app)", Lane: "Today", Position: 0, Notes: "Ship v1.", Repos: "youruser/command-board", LastTouched: iso(0), CreatedAt: iso(5), Archived: false } },
    { fields: { Name: "Clean the backyard", Lane: "Next", Position: 0, Notes: "No repo — local to-dos only.", LastTouched: iso(2), CreatedAt: iso(4), Archived: false } },
    { fields: { Name: "Tax docs", Lane: "Unlabeled", Position: 0, LastTouched: iso(9), CreatedAt: iso(9), Archived: false } },
  ]);
  console.log("✓ seeded Settings + 3 sample projects");
})().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});

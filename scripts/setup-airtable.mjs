#!/usr/bin/env node
// Creates the Command Board schema in your Airtable base (idempotent).
// Run: npm run setup:airtable   (after filling .env)
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// --- minimal .env loader (so the script works without extra deps) ---
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

const dt = () => ({ type: "dateTime", options: { timeZone: "utc", dateFormat: { name: "iso" }, timeFormat: { name: "24hour" } } });
const num = () => ({ type: "number", options: { precision: 0 } });

const TABLES = [
  {
    name: process.env.AIRTABLE_PROJECTS_TABLE || "Projects",
    fields: [
      { name: "Name", type: "singleLineText" },
      { name: "Lane", type: "singleSelect", options: { choices: [{ name: "Today" }, { name: "Next" }, { name: "Unlabeled" }, { name: "Snooze" }] } },
      { name: "Position", ...num() },
      { name: "Notes", type: "multilineText" },
      { name: "Repos", type: "multilineText" },
      { name: "LastTouched", ...dt() },
      { name: "SnoozeUntil", ...dt() },
      { name: "CreatedAt", ...dt() },
      { name: "Archived", type: "checkbox", options: { icon: "check", color: "greenBright" } },
    ],
  },
  {
    name: process.env.AIRTABLE_TASKS_TABLE || "Tasks",
    fields: [
      { name: "Title", type: "singleLineText" },
      { name: "ProjectId", type: "singleLineText" },
      { name: "Done", type: "checkbox", options: { icon: "check", color: "greenBright" } },
      { name: "Order", ...num() },
      { name: "CreatedAt", ...dt() },
    ],
  },
  {
    name: process.env.AIRTABLE_SETTINGS_TABLE || "Settings",
    fields: [
      { name: "Name", type: "singleLineText" },
      { name: "SnoozeDays", ...num() },
      { name: "WarmAfterDays", ...num() },
      { name: "StaleAfterDays", ...num() },
      { name: "WipLimit", ...num() },
    ],
  },
];

const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function existingTables() {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE}/tables`, { headers: H });
  if (!res.ok) throw new Error(`List tables failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return new Map(data.tables.map((t) => [t.name, t]));
}

async function createTable(spec) {
  const res = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE}/tables`, {
    method: "POST",
    headers: H,
    body: JSON.stringify(spec),
  });
  if (!res.ok) throw new Error(`Create ${spec.name} failed (${res.status}): ${await res.text()}`);
  return res.json();
}

(async () => {
  console.log(`Setting up base ${BASE}…`);
  const have = await existingTables();
  for (const spec of TABLES) {
    if (have.has(spec.name)) {
      console.log(`• ${spec.name} already exists — skipped`);
      continue;
    }
    await createTable(spec);
    console.log(`✓ created ${spec.name}`);
  }
  console.log("\nDone. Start the app with: npm run dev");
})().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});

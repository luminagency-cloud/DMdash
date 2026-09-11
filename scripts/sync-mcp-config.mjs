import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const envPath = join(root, ".env.local");
const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {};
// Never use the runtime token for the coding connection. It can access all boards.
const token = env.TRELLO_PROJECT_MCP_TOKEN;
if (!token) {
  console.log("Set TRELLO_PROJECT_MCP_TOKEN in .env.local to configure the project MCP connection.");
  process.exit(0);
}
const url = env.TRELLO_MCP_URL || "https://trello-mcp.luminagency.workers.dev/mcp";
const serverName = "dmdash-trello";
const codexDir = join(root, ".codex");
const codexPath = join(codexDir, "config.toml");
const oldToml = existsSync(codexPath) ? readFileSync(codexPath, "utf8") : "";
const table = `[mcp_servers.${serverName}]\nurl = ${JSON.stringify(url)}\nhttp_headers = { "Authorization" = ${JSON.stringify(`Bearer ${token}`)} }\n`;
const section = /^\[mcp_servers\.dmdash-trello\][^]*?(?=^\[|(?![^]))/m;
const toml = section.test(oldToml) ? oldToml.replace(section, () => table + "\n") : oldToml + "\n" + table;
const mcpPath = join(root, ".mcp.json");
const config = existsSync(mcpPath) ? JSON.parse(readFileSync(mcpPath, "utf8")) : {};
config.mcpServers ??= {};
config.mcpServers[serverName] = { type: "http", url, headers: { Authorization: `Bearer ${token}` } };
mkdirSync(codexDir, { recursive: true });
writeFileSync(codexPath, toml, { mode: 0o600 });
writeFileSync(mcpPath, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
console.log("Updated the DMdash project connection for Codex and Claude Code.");

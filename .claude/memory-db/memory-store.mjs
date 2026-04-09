/**
 * CollabSpace v2 — Local Vector Memory Store
 *
 * Provides semantic memory for all agents using:
 * - Vectra (local JSON-based vector database, pure JS, no native deps)
 * - Transformers.js (local embeddings via all-MiniLM-L6-v2, no API keys)
 *
 * Usage:
 *   node .claude/memory-db/memory-store.mjs add --type <type> --agent <agent> --content "..."
 *   node .claude/memory-db/memory-store.mjs search --query "..." [--type <type>] [--limit 5]
 *   node .claude/memory-db/memory-store.mjs list [--type <type>] [--agent <agent>] [--status <status>]
 *   node .claude/memory-db/memory-store.mjs update --id <id> --content "..." [--status <status>]
 *   node .claude/memory-db/memory-store.mjs delete --id <id>
 *   node .claude/memory-db/memory-store.mjs summary
 *   node .claude/memory-db/memory-store.mjs export [--format md|json]
 *   node .claude/memory-db/memory-store.mjs import --file <path>
 */

import { createRequire } from "module";
import { randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DB_PATH = path.join(__dirname, "vectra-data");

// Use createRequire for CJS modules
const require = createRequire(path.join(PROJECT_ROOT, "node_modules", "vectra", "lib", "index.js"));
const { LocalIndex } = require("vectra");

// ESM import for transformers
const { pipeline } = await import("@xenova/transformers");

// ─── Constants ───────────────────────────────────────────────

const VALID_TYPES = [
  "decision",      // Architecture/PM decisions with rationale
  "task",          // Task-related memories (blockers, learnings)
  "bug",           // Bug discoveries and resolutions
  "design",        // Design decisions, specs, UI/UX notes
  "security",      // Security findings, credential scan results
  "architecture",  // Architecture decisions and constraints
  "feedback",      // User/agent feedback and corrections
  "requirement",   // Requirement clarifications and interpretations
  "release",       // Release notes and iteration summaries
  "context",       // General project context and knowledge
];

const VALID_AGENTS = [
  "project-manager", "devils-advocate", "architect",
  "backend-expert", "frontend-expert", "uiux-designer",
  "qa-agent", "system",
];

const VALID_STATUSES = ["active", "resolved", "archived", "superseded"];

// ─── Embedding ───────────────────────────────────────────────

let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embedder;
}

async function embed(text) {
  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

// ─── Database ────────────────────────────────────────────────

async function getIndex() {
  const index = new LocalIndex(DB_PATH);
  if (!(await index.isIndexCreated())) {
    await index.createIndex();
  }
  return index;
}

// ─── Commands ────────────────────────────────────────────────

async function addMemory({ type, agent, content, summary, tags, relatedTasks, status }) {
  if (!VALID_TYPES.includes(type)) {
    console.error(`Invalid type: ${type}. Valid: ${VALID_TYPES.join(", ")}`);
    process.exit(1);
  }
  if (!VALID_AGENTS.includes(agent)) {
    console.error(`Invalid agent: ${agent}. Valid: ${VALID_AGENTS.join(", ")}`);
    process.exit(1);
  }

  const index = await getIndex();
  const id = `mem-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const textToEmbed = `${summary || ""} ${content}`.trim();
  const vector = await embed(textToEmbed);

  await index.insertItem({
    id,
    vector,
    metadata: {
      type,
      agent,
      content,
      summary: summary || content.slice(0, 120),
      status: status || "active",
      tags: tags || [],
      related_tasks: relatedTasks || [],
      created_at: now,
      updated_at: now,
    },
  });

  console.log(JSON.stringify({
    success: true, id, type, agent,
    summary: summary || content.slice(0, 120),
  }, null, 2));
}

async function searchMemory({ query, type, agent, status, limit }) {
  const index = await getIndex();
  const vector = await embed(query);
  const results = await index.queryItems(vector, limit || 10);

  let items = results.map((r) => ({
    id: r.item.id,
    score: r.score,
    ...r.item.metadata,
  }));

  // Post-filter
  if (type) items = items.filter((r) => r.type === type);
  if (agent) items = items.filter((r) => r.agent === agent);
  if (status) items = items.filter((r) => r.status === status);
  else items = items.filter((r) => r.status !== "archived");

  console.log(JSON.stringify(items, null, 2));
}

async function listMemories({ type, agent, status }) {
  const index = await getIndex();
  const all = await index.listItems();

  let items = all.map((item) => ({
    id: item.id,
    ...item.metadata,
  }));

  if (type) items = items.filter((r) => r.type === type);
  if (agent) items = items.filter((r) => r.agent === agent);
  if (status) items = items.filter((r) => r.status === status);
  else items = items.filter((r) => r.status !== "archived");

  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  console.log(JSON.stringify(items, null, 2));
}

async function updateMemory({ id, content, summary, status, tags, relatedTasks }) {
  const index = await getIndex();
  const existing = await index.getItem(id);
  if (!existing) {
    console.error(`Memory not found: ${id}`);
    process.exit(1);
  }

  const meta = existing.metadata;
  const updatedContent = content || meta.content;
  const updatedSummary = summary || meta.summary;

  // Re-embed if content changed
  let vector = existing.vector;
  if (content || summary) {
    vector = await embed(`${updatedSummary} ${updatedContent}`.trim());
  }

  await index.upsertItem({
    id,
    vector,
    metadata: {
      ...meta,
      content: updatedContent,
      summary: updatedSummary,
      status: status || meta.status,
      tags: tags || meta.tags,
      related_tasks: relatedTasks || meta.related_tasks,
      updated_at: new Date().toISOString(),
    },
  });

  console.log(JSON.stringify({ success: true, id, status: status || meta.status }, null, 2));
}

async function deleteMemory({ id }) {
  const index = await getIndex();
  await index.deleteItem(id);
  console.log(JSON.stringify({ success: true, deleted: id }, null, 2));
}

async function memorySummary() {
  const index = await getIndex();
  const all = await index.listItems();
  const stats = { total: all.length, by_type: {}, by_agent: {}, by_status: {}, recent: [] };

  for (const item of all) {
    const m = item.metadata;
    stats.by_type[m.type] = (stats.by_type[m.type] || 0) + 1;
    stats.by_agent[m.agent] = (stats.by_agent[m.agent] || 0) + 1;
    stats.by_status[m.status] = (stats.by_status[m.status] || 0) + 1;
  }

  const sorted = all
    .map((i) => ({ id: i.id, ...i.metadata }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  stats.recent = sorted.slice(0, 5).map(({ id, type, agent, summary, created_at }) => ({
    id, type, agent, summary, created_at,
  }));

  console.log(JSON.stringify(stats, null, 2));
}

async function exportMemories({ format }) {
  const index = await getIndex();
  const all = await index.listItems();

  if (format === "json") {
    const output = all.map((i) => ({ id: i.id, ...i.metadata }));
    console.log(JSON.stringify(output, null, 2));
  } else {
    let md = "# CollabSpace v2 — Memory Export\n\n";
    md += `> Exported: ${new Date().toISOString()}\n`;
    md += `> Total memories: ${all.length}\n\n`;

    const byType = {};
    for (const item of all) {
      const m = item.metadata;
      if (!byType[m.type]) byType[m.type] = [];
      byType[m.type].push({ id: item.id, ...m });
    }

    for (const [type, records] of Object.entries(byType)) {
      md += `## ${type.charAt(0).toUpperCase() + type.slice(1)}\n\n`;
      for (const r of records) {
        md += `### ${r.id} — ${r.summary}\n`;
        md += `- **Agent:** ${r.agent} | **Status:** ${r.status} | **Created:** ${r.created_at}\n`;
        md += `- **Tags:** ${(r.tags || []).join(", ") || "none"}\n\n`;
        md += `${r.content}\n\n---\n\n`;
      }
    }
    console.log(md);
  }
}

async function importMemories({ file }) {
  if (!existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(file, "utf-8"));
  let count = 0;
  for (const entry of data) {
    await addMemory({
      type: entry.type || "context",
      agent: entry.agent || "system",
      content: entry.content,
      summary: entry.summary,
      tags: entry.tags,
      relatedTasks: entry.related_tasks,
      status: entry.status || "active",
    });
    count++;
  }
  console.log(JSON.stringify({ success: true, imported: count }, null, 2));
}

// ─── CLI ─────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2).replace(/-/g, "_");
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true;
      if (val !== true) i++;
      if (key === "tags" && typeof val === "string") {
        args[key] = val.split(",").map((t) => t.trim());
      } else if (key === "related_tasks" && typeof val === "string") {
        args[key] = val.split(",").map((t) => t.trim());
      } else if (key === "limit") {
        args[key] = parseInt(val, 10);
      } else {
        args[key] = val;
      }
    }
  }
  return args;
}

const command = process.argv[2];
const args = parseArgs(process.argv.slice(3));

switch (command) {
  case "add":
    if (!args.type || !args.agent || !args.content) {
      console.error('Usage: add --type <type> --agent <agent> --content "..." [--summary "..."] [--tags "t1,t2"] [--related_tasks "T-001,T-002"]');
      process.exit(1);
    }
    await addMemory(args);
    break;
  case "search":
    if (!args.query) {
      console.error('Usage: search --query "..." [--type <type>] [--agent <agent>] [--limit 10]');
      process.exit(1);
    }
    await searchMemory(args);
    break;
  case "list":
    await listMemories(args);
    break;
  case "update":
    if (!args.id) {
      console.error("Usage: update --id <id> [--content ...] [--status ...]");
      process.exit(1);
    }
    await updateMemory(args);
    break;
  case "delete":
    if (!args.id) {
      console.error("Usage: delete --id <id>");
      process.exit(1);
    }
    await deleteMemory(args);
    break;
  case "summary":
    await memorySummary();
    break;
  case "export":
    await exportMemories({ format: args.format || "md" });
    break;
  case "import":
    if (!args.file) {
      console.error("Usage: import --file <path>");
      process.exit(1);
    }
    await importMemories(args);
    break;
  default:
    console.log(`
CollabSpace v2 — Memory Store (Local Vector DB)

Commands:
  add       Add a new memory with semantic embedding
  search    Semantic search across all memories
  list      List memories with optional filters
  update    Update an existing memory
  delete    Delete a memory
  summary   Show memory statistics
  export    Export all memories (md or json)
  import    Import memories from JSON file

Types:   ${VALID_TYPES.join(", ")}
Agents:  ${VALID_AGENTS.join(", ")}
Status:  ${VALID_STATUSES.join(", ")}

Examples:
  node .claude/memory-db/memory-store.mjs add --type decision --agent architect --content "Chose SolidJS over Svelte" --tags "tech-stack"
  node .claude/memory-db/memory-store.mjs search --query "what framework did we pick?"
  node .claude/memory-db/memory-store.mjs list --type bug --agent qa-agent
  node .claude/memory-db/memory-store.mjs update --id mem-abc12345 --status resolved
  node .claude/memory-db/memory-store.mjs summary
`);
}

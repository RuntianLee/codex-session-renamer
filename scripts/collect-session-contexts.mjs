#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

const requestedMode = option("--mode", "all");
if (requestedMode !== "all") {
  throw new Error(`Unsupported mode: ${requestedMode}`);
}
const mode = "all";

const db = option("--db", join(homedir(), ".codex", "state_5.sqlite"));
const defaultLimit = 20;
const requestedLimit = Number.parseInt(option("--limit", String(defaultLimit)), 10);
const requestedOffset = Number.parseInt(option("--offset", "0"), 10);
const limit = Number.isInteger(requestedLimit)
  ? Math.min(Math.max(requestedLimit, 1), 50)
  : defaultLimit;
const offset = Number.isInteger(requestedOffset)
  ? Math.max(requestedOffset, 0)
  : 0;

const query = `
  SELECT
    id,
    rollout_path,
    title,
    archived,
    COALESCE(created_at_ms, created_at * 1000) AS created_at_ms
  FROM threads
  WHERE COALESCE(thread_source, '') IN ('', 'user')
  ORDER BY recency_at_ms DESC, id DESC;
`;
const raw = execFileSync("sqlite3", ["-json", db, query], {
  encoding: "utf8",
});
const rows = raw.trim() ? JSON.parse(raw) : [];
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDate(milliseconds) {
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(milliseconds))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function cleanText(value) {
  return value
    .replace(/<skill>[\s\S]*?<\/skill>/gi, " ")
    .replace(/<recommended_plugins>[\s\S]*?<\/recommended_plugins>/gi, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[\$?[^\]]+\]\([^)]+\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(value, maxLength) {
  const chars = Array.from(cleanText(value));
  if (chars.length <= maxLength) return chars.join("");
  const headLength = Math.floor(maxLength * 0.7);
  const tailLength = maxLength - headLength - 1;
  return `${chars.slice(0, headLength).join("")}…${chars.slice(-tailLength).join("")}`;
}

function messageText(payload) {
  return (payload.content || [])
    .map(part => part.text || part.input_text || part.output_text || "")
    .filter(Boolean)
    .join("\n");
}

function collectContext(row) {
  const users = [];
  const assistants = [];

  if (row.rollout_path && existsSync(row.rollout_path)) {
    for (const line of readFileSync(row.rollout_path, "utf8").split("\n")) {
      if (!line.trim()) continue;

      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      const payload = event.payload || {};
      if (event.type !== "response_item" || payload.type !== "message") continue;

      const text = cleanText(messageText(payload));
      if (text.length < 8) continue;
      if (payload.role === "user") users.push(text);
      if (payload.role === "assistant") assistants.push(text);
    }
  }

  const parts = [];
  const currentTitle = cleanText(row.title || "");
  if (currentTitle) parts.push(`Current title: ${excerpt(currentTitle, 80)}`);
  for (const goal of users.slice(-2)) {
    parts.push(`Recent goal: ${excerpt(goal, 240)}`);
  }
  if (assistants.length) {
    parts.push(`Final result: ${excerpt(assistants.at(-1), 360)}`);
  }
  return parts.join("\n");
}

const selectedRows = rows.slice(offset, offset + limit);
const sessions = selectedRows.map(row => {
  const title = cleanText(row.title || "");
  return {
    id: row.id,
    date: formatDate(row.created_at_ms),
    currentTitle: title,
    archived: Boolean(row.archived),
    context: collectContext(row),
  };
});
const nextOffset = offset + sessions.length < rows.length
  ? offset + sessions.length
  : null;

process.stdout.write(JSON.stringify({
  mode,
  offset,
  total: rows.length,
  nextOffset,
  sessions,
}));

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
const checkOnly = process.argv.includes("--check-only");

const db = option("--db", join(homedir(), ".codex", "state_5.sqlite"));
const sessionIndex = option(
  "--session-index",
  join(homedir(), ".codex", "session_index.jsonl"),
);
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
    COALESCE(created_at_ms, created_at * 1000) AS created_at_ms,
    recency_at_ms
  FROM threads
  WHERE COALESCE(thread_source, '') IN ('', 'user')
  ORDER BY recency_at_ms DESC, id DESC;
`;
const raw = execFileSync("sqlite3", ["-json", db, query], {
  encoding: "utf8",
});
const rows = raw.trim() ? JSON.parse(raw) : [];
const latestTitles = new Map();
if (existsSync(sessionIndex)) {
  for (const line of readFileSync(sessionIndex, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (typeof entry.id === "string"
        && typeof entry.thread_name === "string"
        && entry.thread_name.trim()) {
        latestTitles.set(entry.id, entry.thread_name);
      }
    } catch {
      // Ignore incomplete or legacy index records.
    }
  }
}
const formatter = new Intl.DateTimeFormat("en-CA", {
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

function compliantTitle(title, date) {
  const prefix = `${date}｜`;
  if (!title.startsWith(prefix)) return false;
  const topicLength = Array.from(title.slice(prefix.length)).length;
  return topicLength >= 10
    && topicLength <= 28
    && Array.from(title).length <= 40;
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

function meaningfulUserGoal(value) {
  let text = cleanText(value);
  const requestMarkers = [
    "## My request for Codex:",
    "My request for Codex:",
  ];
  for (const marker of requestMarkers) {
    const markerIndex = text.lastIndexOf(marker);
    if (markerIndex !== -1) {
      text = text.slice(markerIndex + marker.length).trim();
      break;
    }
  }

  if (!text || /^\[?Request interrupted by user/i.test(text)) return "";
  if (/^#?\s*AGENTS\.md instructions\b/i.test(text)) return "";
  if (/^These AGENTS\.md instructions\b/i.test(text)) return "";
  if (/^\d{4}-\d{2}-\d{2}\s+\S+\/\S+\s+\//.test(text)) return "";
  if (/\btoolu_[A-Za-z0-9]+\b/.test(text) && /\b(completed|failed|stopped)\b/i.test(text)) {
    return "";
  }
  return text;
}

function sampleAcross(values, maxSamples) {
  if (values.length <= maxSamples) return values;
  const indexes = Array.from({ length: maxSamples }, (_, index) =>
    Math.round(index * (values.length - 1) / (maxSamples - 1))
  );
  return indexes.map(index => values[index]);
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

function collectSession(row, includeContext) {
  const users = [];
  const assistants = [];
  let lastConversationAtMs = null;

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

      const messageAtMs = Date.parse(event.timestamp);
      const isUser = payload.role === "user";
      const isAssistantResult = payload.role === "assistant"
        && payload.phase !== "commentary";
      if (!isUser && !isAssistantResult) continue;

      const text = isUser
        ? meaningfulUserGoal(messageText(payload))
        : cleanText(messageText(payload));
      if (text.length < 8) continue;
      if (Number.isFinite(messageAtMs)
        && (lastConversationAtMs === null || messageAtMs > lastConversationAtMs)) {
        lastConversationAtMs = messageAtMs;
      }
      if (includeContext && isUser) users.push(text);
      if (includeContext && isAssistantResult) assistants.push(text);
    }
  }

  if (!includeContext) {
    return { context: "", lastConversationAtMs };
  }

  const parts = [];
  const currentTitle = cleanText(row.title || "");
  if (currentTitle) parts.push(`Current title: ${excerpt(currentTitle, 80)}`);
  const sampledGoals = sampleAcross(users, 4);
  for (const [index, goal] of sampledGoals.entries()) {
    parts.push(`Session goal ${index + 1}/${sampledGoals.length}: ${excerpt(goal, 150)}`);
  }
  if (assistants.length) {
    parts.push(`Latest outcome: ${excerpt(assistants.at(-1), 320)}`);
  }
  return {
    context: parts.join("\n"),
    lastConversationAtMs,
  };
}

const selectedRows = rows.slice(offset, offset + limit);
const sessions = selectedRows.map(row => {
  const title = cleanText(latestTitles.get(row.id) || row.title || "");
  const collected = collectSession({ ...row, title }, !checkOnly);
  const date = formatDate(collected.lastConversationAtMs ?? row.created_at_ms);
  const session = {
    id: row.id,
    date,
    currentTitle: title,
    archived: Boolean(row.archived),
    compliant: compliantTitle(title, date),
  };
  if (!checkOnly) session.context = collected.context;
  return session;
});
const nextOffset = offset + sessions.length < rows.length
  ? offset + sessions.length
  : null;
const noncompliantCount = sessions.filter(session => !session.compliant).length;

process.stdout.write(JSON.stringify({
  mode,
  checkOnly,
  offset,
  total: rows.length,
  nextOffset,
  batchCompliant: noncompliantCount === 0,
  noncompliantCount,
  sessions,
}));

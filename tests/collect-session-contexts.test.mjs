import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const skillDir = new URL("..", import.meta.url).pathname;
const script = join(skillDir, "scripts", "collect-session-contexts.mjs");
const skillFile = join(skillDir, "SKILL.md");
const agentMetadata = join(skillDir, "agents", "openai.yaml");

function createDb(db, rows) {
  execFileSync("sqlite3", [
    db,
    `CREATE TABLE threads (
      id TEXT PRIMARY KEY,
      rollout_path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      created_at_ms INTEGER,
      recency_at_ms INTEGER NOT NULL,
      title TEXT NOT NULL,
      archived INTEGER NOT NULL,
      thread_source TEXT
    );
    ${rows.join("\n")}`,
  ]);
}

function message(role, text) {
  return JSON.stringify({
    type: "response_item",
    payload: {
      type: "message",
      role,
      content: [{
        type: role === "user" ? "input_text" : "output_text",
        text,
      }],
    },
  });
}

test("pending mode is unavailable", () => {
  assert.throws(
    () => execFileSync("node", [
      script, "--mode", "pending",
    ], { encoding: "utf8", stdio: "pipe" }),
    error => {
      assert.match(error.stderr, /Unsupported mode: pending/);
      return true;
    },
  );
});

test("default invocation includes dated and archived roots", () => {
  const dir = mkdtempSync(join(tmpdir(), "codex-session-renamer-"));
  const db = join(dir, "state.sqlite");
  const mainRollout = join(dir, "main.jsonl");

  try {
    writeFileSync(mainRollout, [
      message("user", "The first message is not the conversation's core topic"),
      message("assistant", "Starting work"),
      message("user", "Intermediate requirement: preserve compatibility"),
      message("user", "Final core goal: implement full session renaming"),
      message("assistant", "Final result: kept only manual full mode and verified every session."),
    ].join("\n"));
    createDb(db, [
      "INSERT INTO threads VALUES ('dated','',1004,1004000,1004,'2026-07-24｜Existing title',0,'user');",
      "INSERT INTO threads VALUES ('archived','',1003,1003000,1003,'Archived root session',1,'user');",
      `INSERT INTO threads VALUES ('main','${mainRollout.replaceAll("'", "''")}',1002,1002000,1002,'First-message title',0,NULL);`,
      "INSERT INTO threads VALUES ('subagent','',1001,1001000,1001,'Subagent task',0,'subagent');",
    ]);

    const output = execFileSync("node", [
      script, "--db", db, "--limit", "10",
    ], { encoding: "utf8" });
    const result = JSON.parse(output);

    assert.equal(result.mode, "all");
    assert.deepEqual(
      result.sessions.map(({ id }) => id),
      ["dated", "archived", "main"],
    );
    const main = result.sessions.find(({ id }) => id === "main");
    assert.match(main.context, /Final core goal: implement full session renaming/);
    assert.match(main.context, /Final result: kept only manual full mode/);
    assert.doesNotMatch(main.context, /first message is not the conversation's core topic/i);
    assert.match(main.context, /Current title:/);
    assert.match(main.context, /Recent goal:/);
    assert.match(main.context, /Final result:/);
    assert.equal(result.nextOffset, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("skill documents only the manual full workflow", () => {
  const skill = readFileSync(skillFile, "utf8");

  assert.match(skill, /## Manual Full Workflow/);
  assert.doesNotMatch(skill, /## Default Workflow/);
  assert.doesNotMatch(skill, /--mode pending/);
  assert.doesNotMatch(skill, /scheduled automation/);
});

test("language selection is explicit and production skill content is English", () => {
  const skill = readFileSync(skillFile, "utf8");
  const productionContent = [
    skill,
    readFileSync(script, "utf8"),
    readFileSync(agentMetadata, "utf8"),
  ].join("\n");

  assert.match(skill, /Optional language: `language=<language>`/);
  assert.match(
    skill,
    /When omitted, choose each title's language from that session's dominant user-conversation language\./,
  );
  assert.match(
    skill,
    /An explicit language applies to both titles and the final report\./,
  );
  assert.match(
    skill,
    /otherwise in the invoking conversation's language\./,
  );
  assert.doesNotMatch(productionContent, /[\u3400-\u9fff]/);
});

# codex-session-renamer

[English](README.md) | [中文](README.zh-CN.md)

Manually resummarize and rename every root Codex session as `YYYY-MM-DD｜Core topic summary`, using the conversation's real goal and outcome instead of copying its first message.

> **Disclaimer.** A full run changes every root Codex session title and has no built-in rollback. Read [SKILL.md](SKILL.md) before using it.

## What it does

| Capability | Behavior |
| --- | --- |
| Semantic titles | Uses the dominant goal, actual outcome, or final conclusion. |
| Last conversation date | Prefixes every title with the date of its last meaningful conversation in the system's current time zone. |
| Full manual run | Renames every root Codex session, including already-dated and archived sessions. |
| Conversation-aware language | By default, each title follows its own session's dominant user language. |
| Optional language | `language=<language>` forces one language for all titles and user-visible output. |
| Token efficiency | Prefers a token-efficient model when model selection is available and uses compact session context. |
| Scope protection | Excludes ChatGPT conversations and subagent sessions. |
| No automation | Runs only when you explicitly invoke the Skill. |

## Naming and language behavior

The title format is:

```text
YYYY-MM-DD｜Core topic summary
```

The date comes from the last meaningful user message or assistant answer. Progress commentary is ignored. If no valid conversation timestamp is available, the creation date is used instead.

Without a language option:

- each title follows the dominant user language of its own session;
- progress messages and the final report follow the language of the conversation that invoked the Skill;
- ambiguous sessions fall back to the current title language, then to the invoking conversation language.

With an explicit language:

```text
language=English
language=zh-CN
language=ja
```

The selected language applies to every generated title and all user-visible output. Project names, product names, code identifiers, and standard technical terms remain unchanged when appropriate.

## Requirements

- OpenAI Codex with access to local thread-management tools.
- A local Codex session catalog at `~/.codex/state_5.sqlite`.
- Node.js 20 or newer.
- `sqlite3` available on `PATH`.
- Tested on macOS.

## Install with Codex

Tell Codex:

```text
Install the codex-session-renamer Skill from the root of https://github.com/RuntianLee/codex-session-renamer.
```

Codex will use its built-in Skill Installer to place the Skill under `$CODEX_HOME/skills`. The installed Skill becomes available on the next turn.

## Usage

### Automatically choose languages

```text
Use $codex-session-renamer to manually resummarize and rename every root Codex session.
```

### Force one language

```text
Use $codex-session-renamer language=English to manually resummarize and rename every root Codex session.
```

Replace `English` with a language name or BCP-47 tag such as `zh-CN` or `ja`.

> **Important:** this Skill always performs a full rename. It has no incremental mode, scheduled mode, dry run, or automatic title backup.

## How it works

1. Retrieves concise summaries for the 50 most recent Codex tasks.
2. Reads root-session metadata and compact local context in batches of 20.
3. Extracts each last meaningful conversation date, current title, recent meaningful user goals, and final result.
4. Chooses the required language and writes a concise semantic topic.
5. Renames through Codex's official thread tools.
6. Temporarily unarchives archived tasks, renames them, and restores their archived state.
7. Continues until every root session has been considered.

## What `agents/` and `scripts/` do

### `agents/`

This folder contains `openai.yaml`. It tells Codex how to display the Skill:

- its name;
- its short description;
- the example prompt shown when starting it.

It improves the experience in Codex, but it does not scan or rename sessions.

### `scripts/`

This folder contains the helper that prepares session information for Codex. It is required for a reliable full scan.

In simple terms, the script:

1. finds normal root sessions in Codex's local session list;
2. skips ChatGPT conversations and subagent sessions;
3. opens each stored conversation and keeps only the last meaningful conversation date, current title, two recent user requests, and final result;
4. removes noisy content such as attached Skill text, code blocks, and page markup;
5. returns up to 20 short session summaries at a time for Codex to rename.

The script only reads local files. It does not decide the new title, change the database, or rename anything by itself. Codex writes the title through its official session tools.

## Safety and privacy

| Area | Guarantee |
| --- | --- |
| Session content | Read locally only to extract compact naming context. |
| Database | Queried for session metadata; titles are not written directly to SQLite. |
| Renaming | Uses official Codex thread tools. |
| Archived tasks | Restores the original archived state after renaming. |
| Exclusions | Never selects ChatGPT conversations or subagents. |
| Automation | Never creates or updates scheduled automations. |
| Deletion | Never deletes sessions, messages, memories, or project files. |

## Repository contents

```text
.
├── README.md
├── README.zh-CN.md
├── SKILL.md
├── agents/
│   └── openai.yaml
└── scripts/
    └── collect-session-contexts.mjs
```

## Limitations

- Title quality depends on the meaningful context available in each session.
- The collector relies on Codex's current local file layout.
- There is no built-in title history or automatic rollback.

## License

MIT - see [LICENSE](LICENSE).

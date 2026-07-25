# codex-session-renamer

[English](README.md) | [中文](README.zh-CN.md)

[![Tests](https://github.com/RuntianLee/codex-session-renamer/actions/workflows/test.yml/badge.svg)](https://github.com/RuntianLee/codex-session-renamer/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Manually resummarize and rename every root Codex session as `YYYY-MM-DD｜Core topic summary`, using the conversation itself rather than copying its first message.

> **Disclaimer.** This project was built with an AI coding agent and tested on the author's machine. A full run changes every root Codex session title and has no built-in rollback. Read the Skill and scripts before installing, and use it at your own risk.

## What it does

| Capability | Behavior |
| --- | --- |
| Semantic titles | Uses the dominant goal, actual outcome, or final conclusion instead of the raw first message. |
| Creation date | Prefixes each title with the session creation date. |
| Full manual run | Resummarizes every root Codex session, including already-dated and archived sessions. |
| Per-session language | By default, each title follows that session's dominant user-conversation language. |
| Optional language | `language=<language>` forces one language for all titles, progress messages, and the final report. |
| Local context extraction | Reads recent goals and the final result from local Codex session files in batches of 20. |
| Scope protection | Excludes ChatGPT conversations and subagent sessions. |
| No automation | Never creates or updates a scheduled automation. Every run is explicitly triggered by you. |

## Naming and language behavior

The title format is:

```text
YYYY-MM-DD｜Core topic summary
```

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

- OpenAI Codex desktop app with local thread-management tools.
- A local Codex session catalog at `~/.codex/state_5.sqlite`.
- Node.js 20 or newer.
- `sqlite3` available on `PATH`.
- Tested on macOS. Other systems may work if their Codex storage layout and dependencies match.

## Install

```bash
git clone https://github.com/RuntianLee/codex-session-renamer.git
cd codex-session-renamer
./setup.sh
```

The installer copies the Skill into:

```text
${CODEX_HOME:-~/.codex}/skills/codex-session-renamer
```

If that directory already exists, `setup.sh` moves it to a timestamped backup before installing the new version.

## Usage

### Automatically choose languages

Start a Codex conversation and invoke:

```text
Use $codex-session-renamer to manually resummarize and rename every root Codex session.
```

Each title uses its own session language. The progress messages and report use the language of the current conversation.

### Force one language

```text
Use $codex-session-renamer language=English to manually resummarize and rename every root Codex session.
```

You can replace `English` with a language name or BCP-47 tag such as `zh-CN` or `ja`.

> **Important:** this Skill always performs a full rename. It does not provide an incremental mode, scheduled mode, dry run, or automatic title backup.

## How it works

1. The Skill asks Codex for high-quality summaries of the 50 most recent tasks.
2. `scripts/collect-session-contexts.mjs` reads the local root-session catalog and returns batches of 20.
3. For each session, it extracts the current title, the last two meaningful user goals, and the final assistant result.
4. Codex chooses the required language and writes a concise semantic topic.
5. Titles are changed through Codex's `set_thread_title` tool rather than by writing directly to the database.
6. Archived tasks are temporarily unarchived, renamed, and restored to their archived state.
7. Processing continues until every root session has been considered.

The collector reads local metadata and rollout files. It does not write to the Codex database or session files.

## Safety and privacy

| Area | Guarantee |
| --- | --- |
| Session content | Read locally only to extract compact title context. |
| Database | The collector opens the Codex SQLite catalog read-only through `sqlite3` queries. |
| Renaming | Uses official Codex thread tools; no direct title database update. |
| Archived tasks | Original archived state is restored after renaming. |
| Exclusions | ChatGPT conversations and subagents are never selected. |
| Automation | The Skill explicitly forbids creating or updating automations. |
| Deletion | The Skill never deletes sessions, messages, memories, or project files. |

## Running the tests

```bash
node --test tests/collect-session-contexts.test.mjs
```

The tests use temporary SQLite databases and rollout fixtures. They never read or modify your real Codex session data.

To test installation and uninstallation without touching your real Codex home:

```bash
TMP_CODEX_HOME="$(mktemp -d)"
CODEX_HOME="$TMP_CODEX_HOME" ./setup.sh
CODEX_HOME="$TMP_CODEX_HOME" ./uninstall.sh
```

The same test suite runs in GitHub Actions on every push and pull request.

## Project structure

```text
.
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
│   └── collect-session-contexts.mjs
├── tests/
│   └── collect-session-contexts.test.mjs
├── setup.sh
├── uninstall.sh
├── README.md
└── README.zh-CN.md
```

## Limitations

- Title quality depends on the meaningful context available in each session.
- The collector relies on Codex's current local SQLite schema and rollout format; future Codex updates may require adjustments.
- Creation dates are currently formatted in the `Asia/Tokyo` time zone.
- A full run can consume substantial tokens because every root session is resummarized.
- There is no built-in title history or automatic rollback.

## Uninstall

From the cloned repository:

```bash
./uninstall.sh
```

This removes only the installed `codex-session-renamer` Skill directory. It does not alter session titles that were already renamed and does not remove timestamped backups created by `setup.sh`.

## Related project

[codex-disk-guard](https://github.com/RuntianLee/codex-disk-guard) monitors and controls Codex's high-frequency disk logging on macOS without touching sessions or memories.

## License

MIT - see [LICENSE](LICENSE).

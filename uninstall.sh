#!/bin/bash

set -eu

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
DESTINATION="$CODEX_HOME/skills/codex-session-renamer"

if [ ! -e "$DESTINATION" ]; then
  printf 'codex-session-renamer is not installed at %s\n' "$DESTINATION"
  exit 0
fi

if [ ! -f "$DESTINATION/SKILL.md" ] ||
   ! grep -q '^name: codex-session-renamer$' "$DESTINATION/SKILL.md"; then
  printf 'Refusing to remove unrecognized directory: %s\n' "$DESTINATION" >&2
  exit 1
fi

rm -rf "$DESTINATION"
printf 'Removed codex-session-renamer from %s\n' "$DESTINATION"
printf 'Existing Codex session titles were not changed.\n'

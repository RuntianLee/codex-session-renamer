#!/bin/bash

set -eu

SOURCE_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
SKILLS_DIR="$CODEX_HOME/skills"
DESTINATION="$SKILLS_DIR/codex-session-renamer"

mkdir -p "$SKILLS_DIR"

if [ -e "$DESTINATION" ]; then
  BACKUP="$DESTINATION.backup-$(date +%Y%m%d-%H%M%S)"
  mv "$DESTINATION" "$BACKUP"
  printf 'Backed up existing installation to %s\n' "$BACKUP"
fi

mkdir -p "$DESTINATION"
cp "$SOURCE_DIR/SKILL.md" "$DESTINATION/SKILL.md"
cp -R "$SOURCE_DIR/agents" "$DESTINATION/agents"
cp -R "$SOURCE_DIR/scripts" "$DESTINATION/scripts"
chmod +x "$DESTINATION/scripts/collect-session-contexts.mjs"

printf 'Installed codex-session-renamer to %s\n' "$DESTINATION"
printf 'Invoke it manually with: $codex-session-renamer\n'
